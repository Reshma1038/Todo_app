# TaskFlow — Collaborative Todo App

A full-stack todo application with JWT authentication, shareable todo pages,
member management, task assignment, and drag-and-drop task ordering persisted
in MongoDB.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Axios, @dnd-kit |
| Backend | Python, FastAPI, Pydantic v2, JWT (python-jose), bcrypt (passlib) |
| Database | MongoDB (local or MongoDB Atlas) |

## Features

- **Auth** — register, login, logout, JWT access tokens, bcrypt password hashing,
  protected API routes and protected frontend routes
- **Google sign-in** — "Continue with Google" (Google Identity Services ID token
  verified server-side, merged with the JWT system; auto-creates accounts)
- **Avatars** — 8 built-in male/female SVG avatar styles; optional pick at
  signup, changeable anytime from the navbar; shown across the app
- **Completion celebration** — 🎉 confetti + success chime + auto-hiding popup
  whenever a task is marked completed
- **Overdue feedback** — 💛 gentle, encouraging popup for overdue tasks with an
  "Update Due Date" shortcut (never negative)
- **Calendar view** — List/Calendar toggle on every page; tasks appear on their
  due dates in a month grid with overdue highlighting
- **Performance analytics** — dedicated page with stat cards, a 14-day
  completions chart, open-tasks-by-priority and by-category breakdowns, and a
  completion-rate banner (`GET /api/analytics/summary`)
- **Todo Pages** — create / list / open / rename / delete (owner only)
- **Sharing** — invite **existing registered users** by email; non-existing emails
  are rejected, duplicates and owner-invites are blocked; owner can remove members
- **Tasks** — create, update, delete, mark pending/completed, assign to any page
  member; tracks created_by / assigned_to / updated_by and timestamps
- **Drag & Drop** — reorder tasks with @dnd-kit; the order is saved to MongoDB
  and survives page refreshes
- **Task sorting** — sort by Importance, Creation Date, Due Date or
  Alphabetically; stack multiple rules with per-rule direction; drag & drop
  stays available in the default manual order
- **AI natural-language tasks** — type "Complete the project report by Friday,
  this is very important" and the AI extracts the title, priority, due date and
  category, with an editable preview before creating
- **AI priority suggestion** — a ✨ button in the task form analyzes the
  title/description and suggests High / Medium / Low with reasons
- **AI next-task recommendation** — "Suggest Next" analyzes all pending tasks
  (priority + due date + urgency + age) and recommends what to do first, with
  a score breakdown and alternatives
- **Hybrid AI engine** — works offline via a built-in smart NLP engine;
  add `GEMINI_API_KEY` to power it with Google Gemini 3.7 Flash (see
  **GEMINI_SETUP.md** for a step-by-step guide) — automatic fallback keeps
  everything working. No AI packages needed: the backend talks to Gemini's
  REST API with Python's standard library only
- **Task categories** — optional category on every task (Work, Personal,
  Shopping, Health, Finance, Study, Home, …), shown as a chip
- **Due date reminders** — due date on every task; overdue and due-today tasks
  are highlighted on cards and in the detail view; a background watcher polls
  `GET /api/todos/due` every minute and fires in-app toasts plus optional
  browser notifications (bell icon in the navbar) — no manual checking needed
- **Detail view** — "View More" modal with full task info and in-place editing
- **Roles** — Owner (page admin) and Member (full task management)
- **Responsive UI** — desktop, tablet and mobile layouts with toasts, modals,
  empty/loading/error states and confirmation dialogs

## Project structure

```
todo_appp/
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── core/           # config, security (JWT, bcrypt)
│   │   ├── db/             # MongoDB connection + indexes
│   │   ├── models/         # document serializers
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── api/            # route handlers
│   │   ├── services/       # business logic
│   │   └── dependencies/   # auth/permission dependencies
│   ├── requirements.txt
│   ├── .env.example
│   └── test_api.ps1        # end-to-end API test script
└── frontend/               # React application
    ├── src/
    │   ├── api/            # Axios instance + API modules
    │   ├── components/
    │   ├── context/        # AuthContext, ToastContext
    │   ├── pages/
    │   └── utils/
    ├── package.json
    └── .env.example
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB running locally (`mongodb://localhost:27017`) **or** a MongoDB Atlas
  connection string

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env         # edit values (see below)
python -m uvicorn app.main:app --reload
```

Backend `.env`:

```
MONGODB_URI=mongodb://localhost:27017       # or your Atlas SRV string
MONGODB_DB=todo_app
JWT_SECRET=<a long random secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
FRONTEND_URL=http://localhost:5173
```

API runs at http://localhost:8000 — interactive docs at http://localhost:8000/docs.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env         # VITE_API_URL=http://localhost:8000/api
npm run dev
```

App runs at http://localhost:5173.

### 3. Optional: enable "Continue with Google"

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth Client ID** (Web application)
2. Add `http://localhost:5173` to **Authorized JavaScript origins**
3. Set the client id in **both** env files:
   - `backend/.env` → `GOOGLE_CLIENT_ID=...`
   - `frontend/.env` → `VITE_GOOGLE_CLIENT_ID=...`
4. Restart backend + frontend — the Google button appears on the auth pages.
   (Without it, email/password auth works as usual.)

## API Summary

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Register (name, email, password, optional avatar) | — |
| POST | `/api/auth/login` | Login, returns JWT | — |
| POST | `/api/auth/google` | Google sign-in (verifies Google ID token, returns JWT) | — |
| GET | `/api/auth/me` | Current user | Bearer |
| PATCH | `/api/auth/me/avatar` | Change avatar | Bearer |
| POST | `/api/pages` | Create todo page | Bearer |
| GET | `/api/pages` | Pages I own or belong to | Bearer |
| GET | `/api/pages/{id}` | Page detail | Member/Owner |
| PATCH | `/api/pages/{id}` | Rename page | Owner |
| DELETE | `/api/pages/{id}` | Delete page + its todos | Owner |
| POST | `/api/pages/{id}/members` | Invite existing user by email | Owner |
| GET | `/api/pages/{id}/members` | List members | Member/Owner |
| DELETE | `/api/pages/{id}/members/{userId}` | Remove member | Owner |
| POST | `/api/pages/{id}/todos` | Create task | Member/Owner |
| GET | `/api/pages/{id}/todos` | List tasks (ordered) | Member/Owner |
| PATCH | `/api/pages/{id}/todos/reorder` | Persist new task order | Member/Owner |
| GET | `/api/todos/due` | My incomplete tasks with due dates (reminders) | Bearer |
| POST | `/api/ai/assistant` | Chat: questions → data-grounded answers; task text → parsed fields | Bearer |
| POST | `/api/ai/parse-task` | Natural language → title/priority/due date/category | Bearer |
| POST | `/api/ai/suggest-priority` | AI priority suggestion for a task | Bearer |
| GET | `/api/ai/next-task` | Which pending task to do first (optional `?page_id=`) | Bearer |
| GET | `/api/analytics/summary` | Performance analytics (optional `?page_id=`) | Bearer |
| GET | `/api/todos/{id}` | Task detail | Member/Owner |
| PATCH | `/api/todos/{id}` | Update task | Member/Owner |
| DELETE | `/api/todos/{id}` | Delete task | Member/Owner |

## Testing

With the backend running:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File .\test_api.ps1
```

Covers auth flows, validation errors, page/member permission rules, todo CRUD,
reorder persistence, and cascade deletes.
