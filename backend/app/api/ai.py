from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.schemas.ai import (
    AssistantRequest,
    AssistantResponse,
    NextTaskResponse,
    ParsedTaskResponse,
    ParseTaskRequest,
    SuggestPriorityRequest,
    SuggestPriorityResponse,
)
from app.services import ai_service, todo_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/assistant", response_model=AssistantResponse)
def assistant(
    data: AssistantRequest, current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Conversational assistant: questions get data-grounded answers,
    task statements get parsed into structured fields."""
    return ai_service.assistant(data.text, current_user, data.page_id)


@router.post("/parse-task", response_model=ParsedTaskResponse)
def parse_task(
    data: ParseTaskRequest, current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Parse natural language into task fields (title, priority, due date,
    category)."""
    return ai_service.parse_task(data.text)


@router.post("/suggest-priority", response_model=SuggestPriorityResponse)
def suggest_priority(
    data: SuggestPriorityRequest, current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Analyze a task title/description and suggest High / Medium / Low."""
    return ai_service.suggest_priority(data.title, data.description)


@router.get("/next-task", response_model=NextTaskResponse)
def next_task(
    page_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Recommend which pending task to do first, with a score breakdown.

    Scopes to one page when `page_id` is given, otherwise analyzes every
    pending task across all pages the user can access.
    """
    docs, pages_by_id = ai_service.get_pending_todos(current_user, page_id)
    scored = ai_service.score_tasks(docs)
    serialized = {t["id"]: t for t in todo_service.serialize_due(docs, pages_by_id)}

    items = [
        {
            "todo": serialized[str(s["todo"]["_id"])],
            "score": s["score"],
            "reasons": s["reasons"],
            "explanation": s.get("explanation"),
        }
        for s in scored
    ]

    provider = "rules"
    if items:
        llm_pick = ai_service.llm_pick_next(items)
        if llm_pick:
            for index, item in enumerate(items):
                if item["todo"]["id"] == llm_pick["task_id"]:
                    item["explanation"] = llm_pick["reason"]
                    items.insert(0, items.pop(index))
                    provider = llm_pick.get("provider", provider)
                    break

    return {
        "suggestion": items[0] if items else None,
        "alternatives": items[1:3],
        "analyzed": len(items),
        "provider": provider,
        "message": None
        if items
        else "No pending tasks to analyze — you're all caught up!",
    }
