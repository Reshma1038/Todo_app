"""Shared helpers for Mongo document handling."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status


def to_object_id(value: str, detail: str = "Invalid identifier.") -> ObjectId:
    """Convert a string to a Mongo ObjectId or raise HTTP 400."""
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=detail
        )


def utcnow() -> datetime:
    """Timezone-aware current UTC time."""
    return datetime.now(timezone.utc)


def iso(value) -> Optional[str]:
    """Serialize a datetime to an ISO-8601 string (naive values assumed UTC)."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return value
