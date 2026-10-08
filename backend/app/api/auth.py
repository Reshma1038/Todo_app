from typing import Any, Dict

from fastapi import APIRouter, Depends, status

from app.core.security import create_access_token
from app.db.mongodb import users_collection
from app.dependencies.auth import get_current_user
from app.models import utcnow
from app.models.user import serialize_user
from app.schemas.auth import (
    AuthResponse,
    AvatarUpdateRequest,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
)
from app.schemas.user import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register", status_code=status.HTTP_201_CREATED, response_model=AuthResponse
)
def register(data: RegisterRequest):
    """Create an account and return a JWT so the user is logged in immediately."""
    user = auth_service.register_user(data.name, data.email, data.password, data.avatar)
    token = create_access_token(str(user["_id"]))
    return AuthResponse(access_token=token, user=serialize_user(user))


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest):
    user = auth_service.authenticate_user(data.email, data.password)
    token = create_access_token(str(user["_id"]))
    return AuthResponse(access_token=token, user=serialize_user(user))


@router.post("/google", response_model=AuthResponse)
def google_login(data: GoogleLoginRequest):
    """Sign in (or sign up) with a verified Google ID token."""
    user = auth_service.authenticate_google(data.credential)
    token = create_access_token(str(user["_id"]))
    return AuthResponse(access_token=token, user=serialize_user(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return serialize_user(current_user)


@router.patch("/me/avatar", response_model=UserResponse)
def update_avatar(
    data: AvatarUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Change the current user's avatar."""
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"avatar": data.avatar, "updated_at": utcnow()}},
    )
    return serialize_user(users_collection.find_one({"_id": current_user["_id"]}))
