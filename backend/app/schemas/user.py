from typing import Optional

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    avatar: Optional[str] = None
    auth_provider: Optional[str] = "password"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UserBrief(BaseModel):
    id: str
    name: str
    email: EmailStr
    avatar: Optional[str] = None
