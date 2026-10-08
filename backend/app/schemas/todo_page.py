from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.user import UserBrief, UserResponse


class PageCreateRequest(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title is required.")
        if len(value) > 120:
            raise ValueError("Title must be at most 120 characters long.")
        return value


class PageUpdateRequest(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title is required.")
        if len(value) > 120:
            raise ValueError("Title must be at most 120 characters long.")
        return value


class MemberAddRequest(BaseModel):
    email: EmailStr


class MemberResponse(UserBrief):
    role: str  # "owner" | "member"


class PageResponse(BaseModel):
    id: str
    title: str
    owner_id: str
    member_ids: List[str]
    owner: Optional[UserResponse] = None
    members: List[MemberResponse] = []
    role: Optional[str] = None
    todo_count: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
