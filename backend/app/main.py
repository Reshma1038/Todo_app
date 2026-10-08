from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai as ai_router
from app.api import analytics as analytics_router
from app.api import auth as auth_router
from app.api import pages as pages_router
from app.api import todos as todos_router
from app.core.config import settings
from app.db.mongodb import create_indexes, ping


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not ping():
        print("WARNING: could not reach MongoDB at", settings.MONGODB_URI)
    create_indexes()
    yield


app = FastAPI(
    title="Todo App API",
    description="Collaborative todo application with JWT auth and drag-and-drop ordering.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    # In development the Vite dev server may run on any local port
    # (5173, 5174, ...). Allow all localhost origins; tighten this
    # to explicit origins in production.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_json_charset(request: Request, call_next):
    """Declare UTF-8 on JSON responses so older clients (e.g. Windows
    PowerShell 5.1's Invoke-RestMethod) decode emoji/unicode correctly."""
    response = await call_next(request)
    if response.headers.get("content-type") == "application/json":
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response


app.include_router(auth_router.router)
app.include_router(pages_router.router)
app.include_router(todos_router.router)
app.include_router(ai_router.router)
app.include_router(analytics_router.router)


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "message": "Todo App API is running."}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
