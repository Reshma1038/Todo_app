# Todo App — Backend

FastAPI + MongoDB backend for the collaborative todo application.

## Tech

- **FastAPI** — REST API, automatic OpenAPI docs at `/docs`
- **Pydantic v2** — request/response validation
- **MongoDB** (pymongo) — works with a local MongoDB or MongoDB Atlas
- **JWT** (`python-jose`) — stateless auth
- **bcrypt** (`passlib`) — password hashing; plain-text passwords are never stored

## Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then edit values
```

## Environment variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string (local or Atlas SRV) |
| `MONGODB_DB` | Database name (default `todo_app`) |
| `JWT_SECRET` | Secret used to sign JWTs — use a long random string in production |
| `JWT_ALGORITHM` | JWT algorithm (default `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime |
| `FRONTEND_URL` | Allowed CORS origin of the React app |

## Run

```bash
python -m uvicorn app.main:app --reload
```

API: http://localhost:8000 — interactive docs: http://localhost:8000/docs

## Tests

A PowerShell end-to-end test script exercises every endpoint and business rule
(register/login, page CRUD, member invite rules, todo CRUD, reorder, permissions):

```powershell
powershell -ExecutionPolicy Bypass -File .\test_api.ps1
```

## Structure

```
app/
├── main.py               # FastAPI app, CORS, router registration, index creation
├── core/
│   ├── config.py         # Settings from environment / .env
│   └── security.py       # bcrypt hashing + JWT encode/decode
├── db/
│   └── mongodb.py        # Mongo client, collections, index creation
├── models/               # Mongo document serializers (no password_hash leaks)
├── schemas/              # Pydantic request/response models
├── services/             # Business logic (auth, pages, todos)
├── dependencies/
│   └── auth.py           # get_current_user, require_page_access, require_page_owner
└── api/
    ├── auth.py           # /api/auth/*
    ├── pages.py          # /api/pages/* incl. members
    └── todos.py          # /api/pages/{id}/todos*, /api/todos/{id}
```
