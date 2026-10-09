from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import HTTPException, status

from app.db.mongodb import todo_pages_collection, todos_collection, users_collection
from app.models import to_object_id, utcnow
from app.models.todo import TODO_REPEATS, serialize_todo

import calendar
from datetime import date, timedelta


def _users_lookup(docs: List[Dict[str, Any]]) -> Dict[ObjectId, Dict[str, Any]]:
    """Resolve all user references of the given todos to user documents."""
    ids = set()
    for doc in docs:
        for key in ("created_by", "assigned_to", "updated_by"):
            oid = doc.get(key)
            if oid is not None:
                ids.add(oid)
    if not ids:
        return {}
    return {u["_id"]: u for u in users_collection.find({"_id": {"$in": list(ids)}})}


def _assert_assignable(page: Dict[str, Any], assigned_to: Optional[str]) -> Optional[ObjectId]:
    """Validate that the assignee is the page owner or a page member."""
    if assigned_to is None:
        return None
    oid = to_object_id(assigned_to, "Invalid assignee id.")
    allowed = {page["owner_id"], *page.get("member_ids", [])}
    if oid not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tasks can only be assigned to members of this page.",
        )
    if not users_collection.find_one({"_id": oid}):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned user does not exist.",
        )
    return oid


def _parse_due_day(value: Optional[str]) -> Optional[date]:
    """Parse a YYYY-MM-DD due-date string; None when missing/invalid."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _add_months(day: date, months: int = 1) -> date:
    """Add months, clamping to month end (Jan 31 -> Feb 28)."""
    month = day.month - 1 + months
    year = day.year + month // 12
    month = month % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day.day, last_day))


def _add_interval(day: date, repeat: str) -> date:
    if repeat == "daily":
        return day + timedelta(days=1)
    if repeat == "weekly":
        return day + timedelta(weeks=1)
    return _add_months(day, 1)  # monthly


def next_due_date(due_date: Optional[str], repeat: str) -> Optional[str]:
    """Compute the next due date for a recurrence.

    Anchored on the current due date to preserve cadence; when there is no
    due date (or the cadence fell behind), anchored on today so the next
    occurrence always lands in the future.
    """
    if (repeat or "none") == "none":
        return None
    today = utcnow().date()
    anchor = _parse_due_day(due_date) or today
    candidate = _add_interval(anchor, repeat)
    if candidate <= today:
        candidate = _add_interval(today, repeat)
    return candidate.isoformat()


def _spawn_next_occurrence(
    page: Dict[str, Any], completed_doc: Dict[str, Any], user: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Create the next pending occurrence of a completed recurring task.

    The completed task is never modified here (history preserved); the new
    task copies its content/settings and links back via parent_id/series_id.
    """
    repeat = completed_doc.get("repeat") or "none"
    if repeat == "none":
        return None

    series_id = completed_doc.get("series_id")
    if not series_id:
        # Backfill for tasks created before the repeat feature existed.
        series_id = ObjectId()
        todos_collection.update_one(
            {"_id": completed_doc["_id"]}, {"$set": {"series_id": series_id}}
        )
        completed_doc["series_id"] = series_id

    last = todos_collection.find_one(
        {"page_id": page["_id"]}, sort=[("position", -1)]
    )
    position = (last["position"] + 1) if last else 0
    now = utcnow()
    # Carry the assignee over only if they can still be assigned.
    assigned = completed_doc.get("assigned_to")
    if assigned is not None:
        allowed = {page["owner_id"], *page.get("member_ids", [])}
        if assigned not in allowed:
            assigned = None

    doc = {
        "page_id": page["_id"],
        "title": completed_doc.get("title", ""),
        "description": completed_doc.get("description", ""),
        "status": "pending",
        "priority": completed_doc.get("priority", "medium"),
        "due_date": next_due_date(completed_doc.get("due_date"), repeat),
        "category": completed_doc.get("category"),
        "repeat": repeat,
        "series_id": series_id,
        "parent_id": completed_doc["_id"],
        "position": position,
        "created_by": user["_id"],
        "assigned_to": assigned,
        "updated_by": user["_id"],
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }
    result = todos_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def create_todo(page: Dict[str, Any], user: Dict[str, Any], data) -> Dict[str, Any]:
    last = todos_collection.find_one(
        {"page_id": page["_id"]}, sort=[("position", -1)]
    )
    position = (last["position"] + 1) if last else 0
    now = utcnow()
    repeat = getattr(data, "repeat", "none") or "none"
    if repeat not in TODO_REPEATS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid repeat value.",
        )
    doc = {
        "page_id": page["_id"],
        "title": data.title,
        "description": data.description or "",
        "status": data.status,
        "priority": data.priority,
        "due_date": data.due_date or None,
        "category": data.category,
        "repeat": repeat,
        # A series groups every occurrence spawned from one recurring task,
        # so history stays linked even as new occurrences are created.
        "series_id": ObjectId() if repeat != "none" else None,
        "parent_id": None,
        "position": position,
        "created_by": user["_id"],
        "assigned_to": _assert_assignable(page, data.assigned_to),
        "updated_by": user["_id"],
        "created_at": now,
        "updated_at": now,
        "completed_at": now if data.status == "completed" else None,
    }
    result = todos_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    # Creating an already-completed recurring task still schedules the next
    # occurrence (same rule as completing it via update).
    if doc["status"] == "completed" and doc["repeat"] != "none":
        _spawn_next_occurrence(page, doc, user)
    return doc


def list_todos(page: Dict[str, Any]) -> List[Dict[str, Any]]:
    return list(
        todos_collection.find({"page_id": page["_id"]}).sort("position", 1)
    )


def get_todo(todo_id: ObjectId) -> Optional[Dict[str, Any]]:
    return todos_collection.find_one({"_id": todo_id})


def update_todo(todo: Dict[str, Any], page: Dict[str, Any], user: Dict[str, Any], data) -> Dict[str, Any]:
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return todo

    set_fields: Dict[str, Any] = {}
    if "title" in updates:
        set_fields["title"] = updates["title"]
    if "description" in updates:
        set_fields["description"] = updates["description"]
    if "status" in updates:
        new_status = updates["status"]
        set_fields["status"] = new_status
        # Track completion time for analytics.
        if new_status == "completed" and todo.get("status") != "completed":
            set_fields["completed_at"] = utcnow()
        elif new_status != "completed" and todo.get("status") == "completed":
            set_fields["completed_at"] = None
    if "priority" in updates:
        set_fields["priority"] = updates["priority"]
    if "due_date" in updates:  # may be None -> clears the due date
        set_fields["due_date"] = updates["due_date"] or None
    if "category" in updates:  # may be None -> clears the category
        set_fields["category"] = updates["category"]
    if "repeat" in updates:  # none disables future recurrences (history kept)
        new_repeat = updates["repeat"] or "none"
        if new_repeat not in TODO_REPEATS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid repeat value.",
            )
        set_fields["repeat"] = new_repeat
        # Enabling repeat on a task that predates the feature still needs a
        # series so later occurrences link back to this history.
        if new_repeat != "none" and not todo.get("series_id"):
            set_fields["series_id"] = ObjectId()
    if "assigned_to" in updates:  # may be None -> unassigns the task
        set_fields["assigned_to"] = _assert_assignable(page, updates["assigned_to"])

    set_fields["updated_by"] = user["_id"]
    set_fields["updated_at"] = utcnow()
    todos_collection.update_one({"_id": todo["_id"]}, {"$set": set_fields})
    fresh = get_todo(todo["_id"])
    # Completing a recurring task schedules the next occurrence; the completed
    # task itself is left untouched so its history/status is preserved.
    if (
        fresh
        and fresh.get("status") == "completed"
        and todo.get("status") != "completed"
        and (fresh.get("repeat") or "none") != "none"
    ):
        _spawn_next_occurrence(page, fresh, user)
    return fresh


def delete_todo(todo: Dict[str, Any]) -> None:
    todos_collection.delete_one({"_id": todo["_id"]})
    # Compact positions so ordering stays gap-free.
    remaining = list(
        todos_collection.find({"page_id": todo["page_id"]}).sort("position", 1)
    )
    for index, doc in enumerate(remaining):
        if doc.get("position") != index:
            todos_collection.update_one(
                {"_id": doc["_id"]}, {"$set": {"position": index}}
            )


def reorder_todos(page: Dict[str, Any], task_ids: List[str]) -> List[Dict[str, Any]]:
    """Persist a new ordering. `task_ids` must cover every todo of the page."""
    existing = list(todos_collection.find({"page_id": page["_id"]}))
    existing_ids = {str(t["_id"]) for t in existing}
    if set(task_ids) != existing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reorder request must include every task of the page exactly once.",
        )
    now = utcnow()
    for position, task_id in enumerate(task_ids):
        todos_collection.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {"position": position, "updated_at": now}},
        )
    return list_todos(page)


def list_due_todos(user: Dict[str, Any]):
    """All *incomplete* todos with a due date across every page the user can
    access (owned or shared), sorted by due date ascending.

    Returns (todo_docs, pages_by_id) so callers can attach page titles.
    """
    pages = list(
        todo_pages_collection.find(
            {"$or": [{"owner_id": user["_id"]}, {"member_ids": user["_id"]}]}
        )
    )
    pages_by_id = {p["_id"]: p for p in pages}
    if not pages_by_id:
        return [], {}
    docs = list(
        todos_collection.find(
            {
                "page_id": {"$in": list(pages_by_id.keys())},
                "due_date": {"$ne": None},
                "status": {"$ne": "completed"},
            }
        ).sort("due_date", 1)
    )
    return docs, pages_by_id


def serialize_many(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    lookup = _users_lookup(docs)
    return [serialize_todo(doc, lookup) for doc in docs]


def serialize_due(
    docs: List[Dict[str, Any]], pages_by_id: Dict[ObjectId, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    lookup = _users_lookup(docs)
    result = []
    for doc in docs:
        data = serialize_todo(doc, lookup)
        page = pages_by_id.get(doc["page_id"])
        data["page_title"] = page["title"] if page else None
        result.append(data)
    return result


def serialize_one(doc: Dict[str, Any]) -> Dict[str, Any]:
    return serialize_todo(doc, _users_lookup([doc]))
