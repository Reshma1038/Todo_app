from typing import List, Optional

from pydantic import BaseModel, field_validator

from app.schemas.todo import TodoResponse


class ParseTaskRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Please enter a task description.")
        if len(value) > 1000:
            raise ValueError("Text is too long (max 1000 characters).")
        return value


class ParsedTaskResponse(BaseModel):
    title: str
    priority: str
    due_date: Optional[str] = None
    category: Optional[str] = None
    signals: List[str] = []
    provider: str = "rules"


class SuggestPriorityRequest(BaseModel):
    title: str
    description: str = ""

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title is required for a priority suggestion.")
        return value.strip()


class SuggestPriorityResponse(BaseModel):
    priority: str
    reasons: List[str] = []
    provider: str = "rules"


class NextTaskItem(BaseModel):
    todo: TodoResponse
    score: int
    reasons: List[str] = []
    explanation: Optional[str] = None


class NextTaskResponse(BaseModel):
    suggestion: Optional[NextTaskItem] = None
    alternatives: List[NextTaskItem] = []
    analyzed: int = 0
    provider: str = "rules"
    message: Optional[str] = None


class AssistantRequest(BaseModel):
    text: str
    page_id: Optional[str] = None

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Please type a question or describe a task.")
        if len(value) > 1000:
            raise ValueError("Text is too long (max 1000 characters).")
        return value


class AssistantResponse(BaseModel):
    """The assistant either answers a question or parses a task statement."""

    kind: str  # "answer" | "task"
    answer: Optional[str] = None
    parsed: Optional[ParsedTaskResponse] = None
    provider: str = "rules"
