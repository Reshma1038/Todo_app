from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import HTTPException, status

from app.db.mongodb import todo_pages_collection, todos_collection, users_collection
from app.models import to_object_id, utcnow
from app.models.todo import serialize_todo


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


def create_todo(page: Dict[str, Any], user: Dict[str, Any], data) -> Dict[str, Any]:
    last = todos_collection.find_one(
        {"page_id": page["_id"]}, sort=[("position", -1)]
    )
    position = (last["position"] + 1) if last else 0
    now = utcnow()
    doc = {
        "page_id": page["_id"],
        "title": data.title,
        "description": data.description or "",
        "status": data.status,
        "priority": data.priority,
        "due_date": data.due_date or None,
        "category": data.category,
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
    if "assigned_to" in updates:  # may be None -> unassigns the task
        set_fields["assigned_to"] = _assert_assignable(page, updates["assigned_to"])

    set_fields["updated_by"] = user["_id"]
    set_fields["updated_at"] = utcnow()
    todos_collection.update_one({"_id": todo["_id"]}, {"$set": set_fields})
    return get_todo(todo["_id"])


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
