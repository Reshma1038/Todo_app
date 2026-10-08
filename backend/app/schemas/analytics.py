from typing import Dict, List

from pydantic import BaseModel


class CategoryCount(BaseModel):
    category: str
    count: int


class DayCount(BaseModel):
    date: str
    count: int


class AnalyticsSummary(BaseModel):
    total_tasks: int
    completed: int
    in_progress: int
    pending: int
    open_tasks: int
    overdue: int
    due_today: int
    completion_rate: int  # 0-100
    completed_this_week: int
    by_priority: Dict[str, int]
    by_category: List[CategoryCount]
    completed_per_day: List[DayCount]
