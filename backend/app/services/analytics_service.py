"""Performance analytics: aggregates across the user's accessible tasks."""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from app.db.mongodb import todo_pages_collection, todos_collection
from app.models import to_object_id

ANALYTICS_DAYS = 14  # length of the "completed per day" series


def get_accessible_todos(user: Dict[str, Any], page_id: Optional[str] = None):
    """All todos (any status) the user may see. Returns (docs, pages_by_id)."""
    if page_id:
        oid = to_object_id(page_id, "Invalid page id.")
        page = todo_pages_collection.find_one({"_id": oid})
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Todo page not found."
            )
        if user["_id"] != page["owner_id"] and user["_id"] not in page.get("member_ids", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this page.",
            )
        pages = [page]
    else:
        pages = list(
            todo_pages_collection.find(
                {"$or": [{"owner_id": user["_id"]}, {"member_ids": user["_id"]}]}
            )
        )
    pages_by_id = {p["_id"]: p for p in pages}
    if not pages_by_id:
        return [], {}
    docs = list(todos_collection.find({"page_id": {"$in": list(pages_by_id.keys())}}))
    return docs, pages_by_id


def _completed_day(doc: Dict[str, Any]) -> Optional[date]:
    """Completion date, falling back to updated_at for legacy documents."""
    ts = doc.get("completed_at") or doc.get("updated_at")
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts.date()
    return None


def build_summary(user: Dict[str, Any], page_id: Optional[str] = None) -> Dict[str, Any]:
    docs, _pages = get_accessible_todos(user, page_id)
    today = date.today()
    today_str = today.isoformat()

    total = len(docs)
    completed = sum(1 for d in docs if d.get("status") == "completed")
    in_progress = sum(1 for d in docs if d.get("status") == "in_progress")
    pending = sum(1 for d in docs if d.get("status") == "pending")
    open_tasks = total - completed
    overdue = sum(
        1
        for d in docs
        if d.get("status") != "completed"
        and d.get("due_date")
        and d["due_date"] < today_str
    )
    due_today = sum(
        1
        for d in docs
        if d.get("status") != "completed" and d.get("due_date") == today_str
    )
    completion_rate = round(100 * completed / total) if total else 0

    # Open tasks by priority
    by_priority = {"high": 0, "medium": 0, "low": 0}
    for d in docs:
        if d.get("status") != "completed":
            by_priority[d.get("priority", "medium")] = (
                by_priority.get(d.get("priority", "medium"), 0) + 1
            )

    # Tasks by category (all tasks, uncategorized bucket included)
    by_category: Dict[str, int] = {}
    for d in docs:
        key = d.get("category") or "Uncategorized"
        by_category[key] = by_category.get(key, 0) + 1
    by_category_list = [
        {"category": k, "count": v}
        for k, v in sorted(by_category.items(), key=lambda kv: (-kv[1], kv[0]))[:6]
    ]

    # Completed per day (last ANALYTICS_DAYS days)
    series = {today - timedelta(days=i): 0 for i in range(ANALYTICS_DAYS - 1, -1, -1)}
    completed_this_week = 0
    week_start = today - timedelta(days=6)
    for d in docs:
        if d.get("status") != "completed":
            continue
        day = _completed_day(d)
        if day is None:
            continue
        if day in series:
            series[day] += 1
        if day >= week_start:
            completed_this_week += 1

    completed_per_day = [
        {"date": day.isoformat(), "count": count} for day, count in series.items()
    ]

    return {
        "total_tasks": total,
        "completed": completed,
        "in_progress": in_progress,
        "pending": pending,
        "open_tasks": open_tasks,
        "overdue": overdue,
        "due_today": due_today,
        "completion_rate": completion_rate,
        "completed_this_week": completed_this_week,
        "by_priority": by_priority,
        "by_category": by_category_list,
        "completed_per_day": completed_per_day,
    }
