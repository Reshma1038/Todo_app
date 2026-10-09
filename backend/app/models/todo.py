from typing import Any, Dict, Optional

from bson import ObjectId

from app.models import iso
from app.models.user import serialize_user_brief

# Allowed values (mirrored by the Pydantic schemas).
TODO_STATUSES = ("pending", "in_progress", "completed")
TODO_PRIORITIES = ("low", "medium", "high")
TODO_REPEATS = ("none", "daily", "weekly", "monthly")


def serialize_todo(
    doc: Dict[str, Any],
    users_by_id: Optional[Dict[ObjectId, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """API representation of a todo document.

    `users_by_id` optionally resolves created_by / assigned_to / updated_by
    ObjectIds to brief user objects for display purposes.
    """
    users_by_id = users_by_id or {}

    def brief(key: str):
        oid = doc.get(key)
        if oid is None:
            return None
        return serialize_user_brief(users_by_id.get(oid))

    assigned_oid = doc.get("assigned_to")
    updated_oid = doc.get("updated_by")

    return {
        "id": str(doc["_id"]),
        "page_id": str(doc["page_id"]),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "status": doc.get("status", "pending"),
        "priority": doc.get("priority", "medium"),
        "due_date": doc.get("due_date"),
        "category": doc.get("category"),
        "repeat": doc.get("repeat", "none"),
        "series_id": str(doc["series_id"]) if doc.get("series_id") else None,
        "parent_id": str(doc["parent_id"]) if doc.get("parent_id") else None,
        "position": doc.get("position", 0),
        "created_by": str(doc["created_by"]),
        "assigned_to": str(assigned_oid) if assigned_oid else None,
        "updated_by": str(updated_oid) if updated_oid else None,
        "created_by_user": brief("created_by"),
        "assigned_to_user": brief("assigned_to"),
        "updated_by_user": brief("updated_by"),
        "created_at": iso(doc.get("created_at")),
        "updated_at": iso(doc.get("updated_at")),
        "completed_at": iso(doc.get("completed_at")),
    }
