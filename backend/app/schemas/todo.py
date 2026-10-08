from typing import List, Literal, Optional

from pydantic import BaseModel, field_validator

from app.schemas.user import UserBrief

TodoStatus = Literal["pending", "in_progress", "completed"]
TodoPriority = Literal["low", "medium", "high"]


def _clean_title(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Title is required.")
    if len(value) > 200:
        raise ValueError("Title must be at most 200 characters long.")
    return value


def _clean_category(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if len(value) > 50:
        raise ValueError("Category must be at most 50 characters long.")
    return value or None


class TodoCreateRequest(BaseModel):
    title: str
    description: str = ""
    status: TodoStatus = "pending"
    priority: TodoPriority = "medium"
    due_date: Optional[str] = None  # ISO date string (YYYY-MM-DD)
    assigned_to: Optional[str] = None
    category: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _clean_title(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        if len(value) > 5000:
            raise ValueError("Description must be at most 5000 characters long.")
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        return _clean_category(value)


class TodoUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TodoStatus] = None
    priority: Optional[TodoPriority] = None
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    category: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _clean_title(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and len(value) > 5000:
            raise ValueError("Description must be at most 5000 characters long.")
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        return _clean_category(value)


class TodoResponse(BaseModel):
    id: str
    page_id: str
    page_title: Optional[str] = None  # attached by the /todos/due endpoint
    title: str
    description: str = ""
    status: str
    priority: str
    due_date: Optional[str] = None
    category: Optional[str] = None
    position: int
    created_by: str
    assigned_to: Optional[str] = None
    updated_by: Optional[str] = None
    created_by_user: Optional[UserBrief] = None
    assigned_to_user: Optional[UserBrief] = None
    updated_by_user: Optional[UserBrief] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None


class ReorderRequest(BaseModel):
    task_ids: List[str]

    @field_validator("task_ids")
    @classmethod
    def validate_task_ids(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("task_ids must not be empty.")
        if len(value) != len(set(value)):
            raise ValueError("task_ids contains duplicates.")
        return value
