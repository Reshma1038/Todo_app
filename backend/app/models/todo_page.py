from typing import Any, Dict, List, Optional

from app.models import iso
from app.models.user import serialize_user, serialize_user_brief


def serialize_member(user_doc: Dict[str, Any], role: str) -> Dict[str, Any]:
    data = serialize_user_brief(user_doc)
    data["role"] = role  # "owner" | "member"
    return data


def serialize_page(
    doc: Dict[str, Any],
    owner: Optional[Dict[str, Any]] = None,
    members: Optional[List[Dict[str, Any]]] = None,
    role: Optional[str] = None,
    todo_count: Optional[int] = None,
) -> Dict[str, Any]:
    """API representation of a todo page document."""
    result = {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "owner_id": str(doc["owner_id"]),
        "member_ids": [str(m) for m in doc.get("member_ids", [])],
        "owner": serialize_user(owner),
        "members": members or [],
        "role": role,
        "created_at": iso(doc.get("created_at")),
        "updated_at": iso(doc.get("updated_at")),
    }
    if todo_count is not None:
        result["todo_count"] = todo_count
    return result
