from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import AVATAR_IDS
from app.schemas.user import UserResponse


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    avatar: Optional[str] = None  # optional avatar picked during signup

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must be at least 2 characters long.")
        if len(value) > 80:
            raise ValueError("Name must be at most 80 characters long.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long.")
        if len(value) > 128:
            raise ValueError("Password must be at most 128 characters long.")
        return value

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if value not in AVATAR_IDS:
            raise ValueError("Invalid avatar selection.")
        return value


class GoogleLoginRequest(BaseModel):
    credential: str  # the Google ID token from the frontend

    @field_validator("credential")
    @classmethod
    def validate_credential(cls, value: str) -> str:
        if len(value.strip()) < 10:
            raise ValueError("Invalid Google credential.")
        return value.strip()


class AvatarUpdateRequest(BaseModel):
    avatar: str

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, value: str) -> str:
        if value not in AVATAR_IDS:
            raise ValueError("Invalid avatar selection.")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("Password is required.")
        return value


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
