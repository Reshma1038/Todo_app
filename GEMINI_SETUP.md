# 🤖 Gemini AI Setup — Step-by-Step Guide

Your Todo app already has every AI feature wired end-to-end. This guide shows
you how to power them with **your own Google Gemini API key**, in plain terms.

---

## Step 1 — Choose the Gemini model

| Model | Best for | Notes |
|---|---|---|
| **`gemini-3.7-flash`** ✅ (default) | Fast structured extraction (titles, dates, priorities) | Current Flash generation — best speed/quality balance |
| `gemini-flash-latest` | Never worrying about model names again | Alias that always tracks Google's current Flash model |
| `gemini-2.5-pro` | Hardest reasoning tasks | Slower/costlier — overkill here |

> ⚠️ Do **not** use `gemini-2.0-flash` — Google retired it (the API answers
> `404 Not Found`). If you see `NOTE: Gemini call failed (HTTP Error 404)`
> in the backend console, that's a retired model name; switch to
> `gemini-flash-latest`.

**Recommendation:** keep `gemini-flash-latest`. You can change it anytime in
`backend/.env` (`GEMINI_MODEL=...`).

## Step 2 — Generate your API key (2 minutes)

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API key"** → choose a project (or create one) → copy the key

That's it — no billing needed for the free tier.

## Step 3 — Store the key securely (never in the frontend, never in git)

Open `backend/.env` and paste:

```env
GEMINI_API_KEY=AIza...your-real-key-here
GEMINI_MODEL=gemini-2.0-flash
```

Why this is safe:
- The key lives **only on the server**. The React app never sees it — all AI
  calls go: `React → your FastAPI → Gemini`.
- The project's root `.gitignore` already excludes `.env`, so the key can't be
  committed to GitHub. (`backend/.env.example` holds only a blank placeholder —
  that file is safe to commit.)

## Step 4 — How the backend connects (already implemented)

`backend/app/core/config.py` loads `GEMINI_API_KEY` / `GEMINI_MODEL` from `.env`
via pydantic-settings. `backend/app/services/ai_service.py` contains
`_gemini_chat()` — a small stdlib (`urllib`) client that POSTs to:

```
POST https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent
Header: x-goog-api-key: <your key>
Body:   { "contents": [{ "role": "user", "parts": [{ "text": "<prompt>" }] }],
          "generationConfig": { "temperature": 0, "responseMimeType": "application/json" } }
```

No new packages to install — it uses Python's built-in HTTP client.

## Step 5 — The AI endpoints (already exist)

| Endpoint | What Gemini does there |
|---|---|
| `POST /api/ai/parse-task` | "Complete the project report by Friday with high priority" → `{title, priority, due_date, category}` |
| `POST /api/ai/suggest-priority` | Analyzes title+description → High/Medium/Low + reason |
| `POST /api/ai/assistant` | Answers questions using your real tasks; parses task statements |
| `GET /api/ai/next-task` | Picks which pending task to do first, with a reason |

## Step 6 — Sending the task description & Step 7 — validating the response

For each request the backend:
1. Builds a strict prompt ("respond with JSON only", today's date for relative dates)
2. Calls Gemini with a 25s timeout
3. **Validates** the JSON: title present, priority ∈ {high, medium, low},
   due_date must parse as `YYYY-MM-DD` — anything invalid is discarded
4. **Fallback safety**: if the key is missing/invalid/expired or the network
   fails, the built-in smart engine answers instead — the app never breaks

## Step 8 — Saving into MongoDB (already wired)

The frontend takes the validated fields and calls the existing
`POST /api/pages/{pageId}/todos` — so AI-created tasks land in the same
`todos` collection with the same permissions as manually created ones.

## Step 9 — The React connection (already wired)

`frontend/src/api/aiApi.js` calls the endpoints above. The violet **AI
Assistant** box on each todo page shows the result with an editable preview,
and badges now read **"Gemini AI ✦"** when Gemini produced the answer
("Smart engine" when the offline fallback did).

## Step 10 — Test it

```powershell
cd backend
python -m uvicorn app.main:app --reload
```

1. Open the app → any todo page → AI Assistant box
2. Type: `Complete the project report by Friday with high priority`
3. You should see the parsed task with the **Gemini AI ✦** badge
4. Try: `What should I do first?` and the ✨ Suggest Next button

If something is wrong with the key, the backend console prints
`NOTE: Gemini call failed (...)` and silently uses the offline engine — check
that note first, then verify the key in `backend/.env`.

---

### Files involved

```
backend/app/core/config.py        # loads GEMINI_API_KEY / GEMINI_MODEL
backend/app/services/ai_service.py# _gemini_chat() client + validation + fallback
backend/app/api/ai.py             # /api/ai/* endpoints
backend/.env                      # ← your real key goes here (git-ignored)
frontend/src/api/aiApi.js         # React → FastAPI calls
frontend/src/components/AiQuickAdd.jsx / NextTaskModal.jsx  # Gemini badge
```
