from typing import Any, Dict, Optional

from app.models import iso

# Built-in avatar ids offered by the frontend (4 male + 4 female styles).
AVATAR_IDS = {f"{gender}_{i}" for gender in ("male", "female") for i in range(1, 5)}


def serialize_user(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Public representation of a user document.

    IMPORTANT: never expose `password_hash` through the API.
    """
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "avatar": doc.get("avatar"),
        "auth_provider": doc.get("auth_provider", "password"),
        "created_at": iso(doc.get("created_at")),
        "updated_at": iso(doc.get("updated_at")),
    }


def serialize_user_brief(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Minimal user representation used for embedded references."""
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "avatar": doc.get("avatar"),
    }
