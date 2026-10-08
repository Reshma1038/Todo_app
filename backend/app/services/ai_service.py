"""AI task intelligence: natural-language task parsing, priority
suggestion, and next-task recommendation.

Two engines power every feature:

  1. A deterministic smart rule engine (always available, no external
     calls, instant) — keyword/pattern NLP for dates, priorities and
     categories, plus a weighted urgency score for recommendations.
  2. Google Gemini (enabled when GEMINI_API_KEY is configured). Any Gemini
     failure falls back to the rule engine, so features never break.

Every response carries `provider`: "gemini" or "rules".
"""

import json
import re
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from app.core.config import settings
from app.db.mongodb import todo_pages_collection, todos_collection
from app.models import to_object_id

# ---------------------------------------------------------------------------
# Rule engine: patterns
# ---------------------------------------------------------------------------

HIGH_PATTERNS = [
    (r"\bextremely important\b", "extremely important"),
    (r"\bvery important\b", "very important"),
    (r"\btop priority\b", "top priority"),
    (r"\bhigh[- ]priority\b", "high priority"),
    (r"\bmust not forget\b", "must not forget"),
    (r"\bdon'?t forget\b", "don't forget"),
    (r"\basap\b", "asap"),
    (r"\burgent\b", "urgent"),
    (r"\bimmediately\b", "immediately"),
    (r"\bcritical\b", "critical"),
    (r"\bdeadline\b", "deadline"),
    (r"\bimportant\b", "important"),
]

LOW_PATTERNS = [
    (r"\blow[- ]priority\b", "low priority"),
    (r"\bnot (so |that )?important\b", "not important"),
    (r"\bnot urgent\b", "not urgent"),
    (r"\bno rush\b", "no rush"),
    (r"\bwhen (you|u) can\b", "when you can"),
    (r"\bwhenever possible\b", "whenever possible"),
    (r"\bif (there'?s|there is) time\b", "if there's time"),
    (r"\bsomeday\b", "someday"),
    (r"\bmaybe\b", "maybe"),
    (r"\beventually\b", "eventually"),
]

CATEGORIES = {
    "Work": ["report", "meeting", "project", "presentation", "client", "email",
             "invoice", "interview", "deploy", "deadline", "contract", "standup",
             "review", "boss", "office"],
    "Shopping": ["buy", "purchase", "order", "groceries", "grocery", "shop",
                 "shopping", "store"],
    "Health": ["doctor", "dentist", "gym", "workout", "medicine", "hospital",
               "yoga", "health", "checkup", "vitamin"],
    "Finance": ["pay", "bill", "bills", "bank", "tax", "taxes", "rent", "emi",
                "insurance", "salary", "budget"],
    "Study": ["learn", "study", "read", "course", "exam", "homework",
              "assignment", "chapter", "lecture", "practice"],
    "Personal": ["call", "birthday", "family", "mom", "dad", "friend", "gift",
                 "anniversary", "wife", "husband"],
    "Home": ["clean", "repair", "fix", "laundry", "kitchen", "garden", "wash",
             "dishes", "vacuum"],
}

WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}

MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9, "october": 10,
    "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
}

FILLER_PREFIXES = [
    r"^\s*(please|pls|plz)\b[\s,]*",
    r"^\s*(i need to|i have to|i must|i want to|i should|i gotta|i'?ve got to|"
    r"remember to|don'?t forget to|do not forget to|note to self[:,]?)\s+",
    r"^\s*(hey|hi)\b[\s,]*(remind me to\s+)?",
]

PRIORITY_PHRASES = [
    r"\bthis is very important\b", r"\bit'?s very important\b",
    r"\bvery important\b", r"\bextremely important\b",
    r"\bit'?s urgent\b", r"\bthis is urgent\b", r"\burgent\b", r"\basap\b",
    r"\bhigh[- ]priority\b", r"\btop priority\b", r"\blow[- ]priority\b",
    r"\bnot urgent\b", r"\bno rush\b", r"\bwhen (you|u) can\b",
    r"\bwhenever possible\b", r"\bsomeday\b", r"\beventually\b",
]

PRIORITY_SCORE = {"high": 30, "medium": 20, "low": 10}


# ---------------------------------------------------------------------------
# Rule engine: extraction helpers
# ---------------------------------------------------------------------------

def _extract_due_date(text: str, today: date) -> Tuple[Optional[date], Optional[str]]:
    """Find a due date expression. Returns (date, matched_source_text)."""
    t = text.lower()

    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", t)
    if m:
        try:
            return date.fromisoformat(m.group(1)), m.group(0)
        except ValueError:
            pass

    m = re.search(r"\bday after tomorrow\b", t)
    if m:
        return today + timedelta(days=2), m.group(0)

    m = re.search(r"\btomorrow\b", t)
    if m:
        return today + timedelta(days=1), m.group(0)

    m = re.search(r"\b(tonight|today|end of (?:the )?day|eod)\b", t)
    if m:
        return today, m.group(0)

    m = re.search(r"\bin\s+(\d+)\s+days?\b", t)
    if m:
        return today + timedelta(days=int(m.group(1))), m.group(0)

    m = re.search(r"\bin\s+(\d+)\s+weeks?\b", t)
    if m:
        return today + timedelta(weeks=int(m.group(1))), m.group(0)

    m = re.search(
        r"\b(?:by|on|before|until|till|due)\s+(next\s+|this\s+)?"
        r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", t)
    if m:
        target = WEEKDAYS[m.group(2)]
        force_next = (m.group(1) or "").strip() == "next"
        days_ahead = (target - today.weekday()) % 7
        if force_next:
            days_ahead += 7
        # "by friday" said on friday means today
        return today + timedelta(days=days_ahead), m.group(0)

    m = re.search(r"\bnext week\b", t)
    if m:
        return today + timedelta(days=7), m.group(0)

    m = re.search(r"\bend of (?:the )?week\b", t)
    if m:
        return today + timedelta(days=(6 - today.weekday()) % 7), m.group(0)

    m = re.search(r"\bend of (?:the )?month\b", t)
    if m:
        first_next = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        return first_next - timedelta(days=1), m.group(0)

    m = re.search(r"\bon\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b", t)
    if m and m.group(1) in MONTHS:
        month, day = MONTHS[m.group(1)], int(m.group(2))
        year = int(m.group(3)) if m.group(3) else today.year
        try:
            d = date(year, month, day)
            if not m.group(3) and d < today:
                d = date(year + 1, month, day)
            return d, m.group(0)
        except ValueError:
            pass

    m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)\b", t)
    if m and m.group(2) in MONTHS:
        month, day = MONTHS[m.group(2)], int(m.group(1))
        try:
            d = date(today.year, month, day)
            if d < today:
                d = date(today.year + 1, month, day)
            return d, m.group(0)
        except ValueError:
            pass

    return None, None


def _infer_priority(text: str, due: Optional[date], today: date) -> Tuple[str, List[str]]:
    t = text.lower()
    score = 0
    reasons: List[str] = []
    for pattern, label in HIGH_PATTERNS:
        if re.search(pattern, t):
            score += 2
            reasons.append(f'mentions "{label}"')
    for pattern, label in LOW_PATTERNS:
        if re.search(pattern, t):
            score -= 2
            reasons.append(f'mentions "{label}"')
    if due is not None:
        delta = (due - today).days
        if delta < 0:
            score += 2
            reasons.append("due date already passed")
        elif delta == 0:
            score += 2
            reasons.append("due today")
        elif delta == 1:
            score += 1
            reasons.append("due tomorrow")
        elif delta <= 3:
            score += 1
            reasons.append("due within 3 days")
    # de-duplicate overlapping matches (e.g. "very important" + "important")
    deduped = list(dict.fromkeys(reasons))
    if score >= 2:
        return "high", deduped
    if score <= -2:
        return "low", deduped
    return "medium", deduped


def _infer_category(text: str) -> Tuple[Optional[str], Optional[str]]:
    t = text.lower()
    for category, words in CATEGORIES.items():
        for word in words:
            if re.search(rf"\b{re.escape(word)}\b", t):
                return category, word
    return None, None


def _clean_title(text: str, date_text: Optional[str]) -> str:
    t = text.strip()
    if date_text:
        t = re.sub(re.escape(date_text), " ", t, flags=re.IGNORECASE)
    for pattern in PRIORITY_PHRASES:
        t = re.sub(pattern, " ", t, flags=re.IGNORECASE)
    for pattern in FILLER_PREFIXES:
        t = re.sub(pattern, "", t, flags=re.IGNORECASE)
    t = re.sub(r"[\s,;.:\-–]+$", "", t)
    t = re.sub(r"\b(by|before|until|till|on|with)\s*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"[\s,;.:\-–]+$", "", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    if not t:
        t = text.strip()[:120]
    return t[0].upper() + t[1:] if t else t


def _score_task(doc: Dict[str, Any], today: date) -> Tuple[int, List[str]]:
    """Weighted urgency score: priority + due-date proximity + task age."""
    score = 0
    reasons: List[str] = []

    priority = doc.get("priority", "medium")
    pts = PRIORITY_SCORE.get(priority, 20)
    score += pts
    reasons.append(f"{priority.capitalize()} priority (+{pts})")

    due_str = doc.get("due_date")
    if due_str:
        try:
            due = date.fromisoformat(due_str)
        except (ValueError, TypeError):
            due = None
        if due is not None:
            delta = (due - today).days
            if delta < 0:
                score += 40
                reasons.append(f"overdue by {-delta} day(s) (+40)")
            elif delta == 0:
                score += 35
                reasons.append("due today (+35)")
            elif delta == 1:
                score += 25
                reasons.append("due tomorrow (+25)")
            elif delta <= 3:
                score += 15
                reasons.append(f"due in {delta} days (+15)")
            elif delta <= 7:
                score += 8
                reasons.append(f"due in {delta} days (+8)")
            else:
                score += 3
                reasons.append(f"due in {delta} days (+3)")

    created = doc.get("created_at")
    if isinstance(created, datetime):
        created_aware = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - created_aware).days
        if age_days >= 7:
            score += 5
            reasons.append(f"open for {age_days} days (+5)")

    return score, reasons


# ---------------------------------------------------------------------------
# Optional LLM provider: Google Gemini (graceful fallback to the built-in
# rule engine on any failure)
# ---------------------------------------------------------------------------

def _gemini_chat(system: str, user: str, json_mode: bool = True) -> Optional[str]:
    """Call Google Gemini's generateContent REST API.

    Uses only the standard library (urllib) — no extra dependencies.
    Returns the model's text, or None on any failure (caller falls back).
    """
    if not settings.GEMINI_API_KEY:
        return None
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )
    generation_config: Dict[str, Any] = {"temperature": 0}
    if json_mode:
        generation_config["responseMimeType"] = "application/json"
    payload = {
        # system prompt inlined for maximum API-version compatibility
        "contents": [{"role": "user", "parts": [{"text": f"{system}\n\n{user}"}]}],
        "generationConfig": generation_config,
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.GEMINI_API_KEY,
        },
        method="POST",
    )
    # Up to 3 attempts with short backoff: the free tier (and preview models)
    # occasionally answer 503/timeouts when overloaded.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:
            if attempt < 2:
                time.sleep(1.0 + attempt)
                continue
            print(f"NOTE: Gemini call failed ({exc}) — falling back.")
            return None


def _ai_chat(system: str, user: str, json_mode: bool = True) -> Tuple[Optional[str], str]:
    """Call Gemini when configured. Returns (content, provider)."""
    if settings.GEMINI_API_KEY:
        content = _gemini_chat(system, user, json_mode)
        if content:
            return content, "gemini"
    return None, "rules"


def _extract_json(text: Optional[str]) -> Optional[dict]:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def _llm_parse_task(text: str) -> Optional[Dict[str, Any]]:
    system = (
        "You extract structured task data from natural language. Respond with "
        'JSON only: {"title": str, "priority": "high"|"medium"|"low", '
        '"due_date": "YYYY-MM-DD"|null, "category": str|null}. '
        f"Today is {date.today().isoformat()}; resolve relative dates against it."
    )
    content, provider = _ai_chat(system, text)
    data = _extract_json(content)
    if not data or not data.get("title"):
        return None
    priority = data.get("priority")
    if priority not in ("high", "medium", "low"):
        priority = "medium"
    due = data.get("due_date")
    if due:
        try:
            date.fromisoformat(str(due))
        except ValueError:
            due = None
    label = "Gemini" if provider == "gemini" else "AI model"
    return {
        "title": str(data["title"])[:200],
        "priority": priority,
        "due_date": due,
        "category": data.get("category"),
        "signals": [f"extracted by {label}"],
        "provider": provider,
    }


def _llm_suggest_priority(title: str, description: str) -> Optional[Dict[str, Any]]:
    system = (
        "You assess task priority. Respond with JSON only: "
        '{"priority": "high"|"medium"|"low", "reason": str}.'
    )
    content, provider = _ai_chat(system, f"{title}\n{description}")
    data = _extract_json(content)
    if not data or data.get("priority") not in ("high", "medium", "low"):
        return None
    return {
        "priority": data["priority"],
        "reasons": [data.get("reason") or "AI model assessment"],
        "provider": provider,
    }


def llm_pick_next(items: List[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    """Ask the LLM to pick one task id from the candidates. Returns
    {"task_id": ..., "reason": ..., "provider": ...} or None."""
    if not items or not settings.GEMINI_API_KEY:
        return None
    candidates = [
        {
            "id": i["todo"]["id"],
            "title": i["todo"]["title"],
            "priority": i["todo"]["priority"],
            "due_date": i["todo"].get("due_date"),
            "page": i["todo"].get("page_title"),
        }
        for i in items
    ]
    system = (
        "You are a productivity coach. Given pending tasks with priority and "
        "due dates, pick the single most urgent task to do first. Respond "
        'with JSON only: {"task_id": str, "reason": str}. '
        f"Today is {date.today().isoformat()}."
    )
    content, provider = _ai_chat(system, json.dumps(candidates))
    data = _extract_json(content)
    if not data or not data.get("task_id"):
        return None
    valid_ids = {i["todo"]["id"] for i in items}
    if data["task_id"] not in valid_ids:
        return None
    return {
        "task_id": data["task_id"],
        "reason": data.get("reason") or "AI model pick",
        "provider": provider,
    }


# ---------------------------------------------------------------------------
# Public API used by the routes
# ---------------------------------------------------------------------------

def parse_task(text: str) -> Dict[str, Any]:
    """Natural-language → structured task fields."""
    llm = _llm_parse_task(text)
    if llm:
        return llm

    today = date.today()
    due, date_text = _extract_due_date(text, today)
    priority, reasons = _infer_priority(text, due, today)
    category, cat_word = _infer_category(text)
    title = _clean_title(text, date_text)

    signals = list(reasons)
    if due and date_text:
        signals.append(f'date "{date_text}" → {due.isoformat()}')
    if category and cat_word:
        signals.append(f'keyword "{cat_word}" → {category}')

    return {
        "title": title,
        "priority": priority,
        "due_date": due.isoformat() if due else None,
        "category": category,
        "signals": signals or ["no strong signals — defaulted to medium priority"],
        "provider": "rules",
    }


def suggest_priority(title: str, description: str) -> Dict[str, Any]:
    """Analyze a task and suggest High / Medium / Low with reasons."""
    llm = _llm_suggest_priority(title, description or "")
    if llm:
        return llm

    text = f"{title or ''} {description or ''}".strip()
    today = date.today()
    due, _ = _extract_due_date(text, today)
    priority, reasons = _infer_priority(text, due, today)
    return {
        "priority": priority,
        "reasons": reasons or ["no urgency or importance signals detected"],
        "provider": "rules",
    }


def get_pending_todos(user: Dict[str, Any], page_id: Optional[str] = None):
    """All non-completed todos the user may see (optionally one page only).

    Returns (docs, pages_by_id). Enforces the same access rules as the rest
    of the API.
    """
    if page_id:
        oid = to_object_id(page_id, "Invalid page id.")
        page = todo_pages_collection.find_one({"_id": oid})
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Todo page not found."
            )
        if user["_id"] != page["owner_id"] and user["_id"] not in page.get("member_ids", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this page.",
            )
        pages = [page]
    else:
        pages = list(
            todo_pages_collection.find(
                {"$or": [{"owner_id": user["_id"]}, {"member_ids": user["_id"]}]}
            )
        )
    pages_by_id = {p["_id"]: p for p in pages}
    if not pages_by_id:
        return [], {}
    docs = list(
        todos_collection.find(
            {"page_id": {"$in": list(pages_by_id.keys())}, "status": {"$ne": "completed"}}
        )
    )
    return docs, pages_by_id


def get_completed_todos(user: Dict[str, Any], page_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Completed todos across accessible pages (for 'list completed' answers)."""
    if page_id:
        oid = to_object_id(page_id, "Invalid page id.")
        page = todo_pages_collection.find_one({"_id": oid})
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Todo page not found."
            )
        if user["_id"] != page["owner_id"] and user["_id"] not in page.get("member_ids", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this page.",
            )
        pages = [page]
    else:
        pages = list(
            todo_pages_collection.find(
                {"$or": [{"owner_id": user["_id"]}, {"member_ids": user["_id"]}]}
            )
        )
    page_ids = [p["_id"] for p in pages]
    if not page_ids:
        return []
    return list(
        todos_collection.find({"page_id": {"$in": page_ids}, "status": "completed"})
    )


def score_tasks(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Score and sort pending tasks: best first. Adds an explanation to #1."""
    today = date.today()
    scored = []
    for doc in docs:
        score, reasons = _score_task(doc, today)
        scored.append({"todo": doc, "score": score, "reasons": reasons})
    scored.sort(key=lambda s: (-s["score"], s["todo"].get("position", 0)))
    if scored:
        top = scored[0]
        bits = [r.split(" (+")[0] for r in top["reasons"][:2]]
        top["explanation"] = (
            f'Start with "{top["todo"].get("title", "")}" — ' + " and ".join(bits).lower() + "."
        )
    return scored


# ---------------------------------------------------------------------------
# AI assistant: question answering grounded in the user's real task data
# ---------------------------------------------------------------------------

QUESTION_WORDS = {
    "what", "when", "why", "how", "where", "who", "whom", "whose", "which",
    "should", "shall", "can", "could", "is", "are", "do", "does", "did",
    "will", "would", "am", "any", "give", "tell", "suggest", "show", "list",
    "help",
}

# ---------------------------------------------------------------------------
# Smalltalk: greetings and casual chat get a friendly reply — NEVER a task.
# ---------------------------------------------------------------------------

_GREETINGS = {
    "hi", "hii", "hiii", "hello", "hey", "heyy", "heyyy", "yo", "hai", "hlo",
    "hola", "namaste", "good morning", "good afternoon", "good evening",
}
_THANKS = {"thanks", "thank you", "thankyou", "thx", "tq", "ty"}
_BYE = {"bye", "byee", "goodbye", "good night", "see you", "cya", "gn"}
_HOWRU = {"how are you", "how r u", "whats up", "what's up", "sup", "wassup"}
_ACKS = {"ok", "okay", "k", "kk", "fine", "great", "nice", "cool", "good"}


def _smalltalk_response(text: str) -> Optional[str]:
    """Short, direct replies for greetings/casual chat; None for real input."""
    t = re.sub(r"[!?.\s]+$", "", text.strip().lower())
    if t in _GREETINGS:
        return "Hello! 👋 How can I help you with your tasks today?"
    if t in _THANKS:
        return "You're welcome! 😊"
    if t in _BYE:
        return "Goodbye! 👋"
    if t in _HOWRU:
        return "Doing great, thanks for asking! 🚀"
    if t in _ACKS:
        return "👍"
    if 0 < len(t) <= 2:
        return "I didn't quite understand that — could you rephrase?"
    return None


def detect_intent(text: str) -> str:
    """Classify input as a "question" (answer it) or a "task" (parse it)."""
    t = text.strip().lower()
    if not t:
        return "task"
    if "?" in t:
        return "question"
    if re.search(
        r"\b(what should|which task|tell me|suggest me|give me|show me|help me|"
        r"list (all |my )?|how many|what'?s due|anything due|any overdue)\b", t):
        return "question"
    first = t.split(" ", 1)[0]
    if first in QUESTION_WORDS:
        return "question"
    return "task"


def _llm_answer(question: str, docs: List[Dict[str, Any]], pages_by_id) -> Optional[Tuple[str, str]]:
    """LLM answer grounded in the user's tasks. Returns (answer, provider)
    or None when unavailable."""
    tasks = [
        {
            "title": d.get("title"),
            "priority": d.get("priority"),
            "status": d.get("status"),
            "due_date": d.get("due_date"),
            "category": d.get("category"),
            "page": (pages_by_id.get(d["page_id"]) or {}).get("title"),
        }
        for d in docs[:30]
    ]
    system = (
        "You are a helpful todo-list assistant. Answer the user's question "
        "using ONLY the task data provided. Be concise (1-3 sentences), "
        "mention specific task titles when relevant. "
        f"Today is {date.today().isoformat()}."
    )
    content, provider = _ai_chat(
        system, json.dumps({"tasks": tasks, "question": question}), json_mode=False
    )
    if not content:
        return None
    return content.strip(), provider


def answer_question(text: str, user: Dict[str, Any], page_id: Optional[str] = None) -> str:
    """Rule-based, data-grounded answer about the user's pending tasks."""
    t = text.lower()
    docs, pages_by_id = get_pending_todos(user, page_id)
    today_str = date.today().isoformat()

    def fmt(doc) -> str:
        suffix = f' (due {doc["due_date"]})' if doc.get("due_date") else ""
        return f'"{doc.get("title", "")}"{suffix}'

    overdue = [d for d in docs if (d.get("due_date") or "9999") < today_str]
    due_today = [d for d in docs if d.get("due_date") == today_str]
    high = [d for d in docs if d.get("priority") == "high"]

    # what to do first / next
    if re.search(
        r"(what|which).*(first|next)|should i (do|start|work|focus)|next task|"
        r"do first|most (important|urgent)|priority task", t):
        scored = score_tasks(docs)
        if not scored:
            return "You have no pending tasks — you're all caught up! 🎉"
        top = scored[0]
        why = " and ".join(r.split(" (+")[0].lower() for r in top["reasons"][:2])
        return (
            f"I recommend {fmt(top['todo'])} — it's {why}. "
            f"You have {len(docs)} pending task(s) in total."
        )

    if "overdue" in t:
        if not overdue:
            return "Nothing is overdue — great job staying on track! ✅"
        names = ", ".join(fmt(d) for d in overdue[:3])
        more = f" and {len(overdue) - 3} more" if len(overdue) > 3 else ""
        return f"You have {len(overdue)} overdue task(s): {names}{more}. I'd tackle those first."

    if re.search(r"\bhow many\b", t):
        return (
            f"You have {len(docs)} pending task(s): {len(high)} high priority, "
            f"{len(overdue)} overdue."
        )

    if "today" in t:
        if not due_today:
            return "Nothing is due today."
        names = ", ".join(fmt(d) for d in due_today[:3])
        return f"{len(due_today)} task(s) are due today: {names}."

    if "week" in t:
        end = (date.today() + timedelta(days=7)).isoformat()
        this_week = [
            d for d in docs
            if d.get("due_date") and today_str <= d["due_date"] <= end
        ]
        if not this_week:
            return "Nothing is due within the next 7 days."
        names = ", ".join(fmt(d) for d in this_week[:3])
        return f"{len(this_week)} task(s) due within a week: {names}."

    # list / show tasks (natural-language listing)
    if re.search(
        r"\blist\b|\bshow\b|\bdisplay\b|\bmy tasks\b|\ball tasks\b|\bwhat are my tasks\b",
        t,
    ):
        if re.search(r"\b(completed|complete|done|finished)\b", t):
            done = get_completed_todos(user, page_id)
            if not done:
                return "No completed tasks yet — finish one and I'll celebrate with you! 🎉"
            lines = [f"{i + 1}. {fmt(d)} ✅" for i, d in enumerate(done[:10])]
            more = f"\n…and {len(done) - 10} more." if len(done) > 10 else ""
            return f"You've completed {len(done)} task(s):\n" + "\n".join(lines) + more

        if not docs:
            return "You have no pending tasks. Describe one and I'll add it for you!"
        ordered = sorted(
            docs,
            key=lambda d: (d.get("due_date") is None, d.get("due_date") or "", d.get("position", 0)),
        )
        lines = []
        for i, d in enumerate(ordered[:10]):
            bits = []
            if d.get("priority") == "high":
                bits.append("high priority")
            due = d.get("due_date")
            if due:
                if due < today_str:
                    bits.append(f"overdue ({due})")
                elif due == today_str:
                    bits.append("due today")
                else:
                    bits.append(f"due {due}")
            suffix = f" — {', '.join(bits)}" if bits else ""
            lines.append(f"{i + 1}. \"{d.get('title', '')}\"{suffix}")
        more = f"\n…and {len(ordered) - 10} more." if len(ordered) > 10 else ""
        return (
            f"Here are your {len(docs)} pending task(s):\n" + "\n".join(lines) + more
        )

    if "high priority" in t or "important" in t:
        if not high:
            return "No high-priority tasks right now — nice! ✨"
        names = ", ".join(fmt(d) for d in high[:3])
        return f"{len(high)} high-priority task(s): {names}."

    # generic fallback: quick summary
    if not docs:
        return "You have no pending tasks."
    scored = score_tasks(docs)
    top = scored[0]
    return (
        f"You have {len(docs)} pending task(s); the most urgent is {fmt(top['todo'])}."
    )


def assistant(text: str, user: Dict[str, Any], page_id: Optional[str] = None) -> Dict[str, Any]:
    """Route between answering a question and parsing a task statement."""
    # 1) Greetings / casual chat: friendly reply, never a task parse.
    smalltalk = _smalltalk_response(text)
    if smalltalk:
        return {"kind": "answer", "answer": smalltalk, "parsed": None, "provider": "rules"}

    # 2) Questions get data-grounded answers.
    if detect_intent(text) == "question":
        docs, pages_by_id = get_pending_todos(user, page_id)
        llm = _llm_answer(text, docs, pages_by_id)
        if llm:
            answer, provider = llm
            return {"kind": "answer", "answer": answer, "parsed": None, "provider": provider}
        return {
            "kind": "answer",
            "answer": answer_question(text, user, page_id),
            "parsed": None,
            "provider": "rules",
        }
    parsed = parse_task(text)
    return {
        "kind": "task",
        "answer": None,
        "parsed": parsed,
        "provider": parsed.get("provider", "rules"),
    }
