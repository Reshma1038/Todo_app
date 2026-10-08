from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import HTTPException, status

from app.db.mongodb import todo_pages_collection, todos_collection, users_collection
from app.models import to_object_id, utcnow
from app.models.todo_page import serialize_member, serialize_page


def create_page(owner_id: ObjectId, title: str) -> Dict[str, Any]:
    now = utcnow()
    doc = {
        "title": title,
        "owner_id": owner_id,
        "member_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    result = todo_pages_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def list_pages_for_user(user_id: ObjectId) -> List[Dict[str, Any]]:
    """All pages the user owns or is a member of, most recently updated first."""
    cursor = todo_pages_collection.find(
        {"$or": [{"owner_id": user_id}, {"member_ids": user_id}]}
    ).sort("updated_at", -1)
    return list(cursor)


def get_page(page_id: ObjectId) -> Optional[Dict[str, Any]]:
    return todo_pages_collection.find_one({"_id": page_id})


def rename_page(page: Dict[str, Any], title: str) -> Dict[str, Any]:
    todo_pages_collection.update_one(
        {"_id": page["_id"]}, {"$set": {"title": title, "updated_at": utcnow()}}
    )
    page.update({"title": title, "updated_at": utcnow()})
    return get_page(page["_id"])


def delete_page(page: Dict[str, Any]) -> None:
    """Delete the page and every todo that belongs to it."""
    todos_collection.delete_many({"page_id": page["_id"]})
    todo_pages_collection.delete_one({"_id": page["_id"]})


def add_member_by_email(page: Dict[str, Any], email: str) -> Dict[str, Any]:
    """Share the page with an existing registered user.

    Business rules:
      - the email must belong to a registered user (no auto-creation),
      - the owner cannot be invited,
      - duplicate membership is rejected.
    """
    email = email.strip().lower()
    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered user found with this email.",
        )
    if user["_id"] == page["owner_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The page owner cannot be invited as a member.",
        )
    if user["_id"] in page.get("member_ids", []):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this page.",
        )
    todo_pages_collection.update_one(
        {"_id": page["_id"]},
        {"$push": {"member_ids": user["_id"]}, "$set": {"updated_at": utcnow()}},
    )
    return user


def remove_member(page: Dict[str, Any], user_id: str) -> None:
    member_oid = to_object_id(user_id, "Invalid user id.")
    if member_oid == page["owner_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The page owner cannot be removed.",
        )
    if member_oid not in page.get("member_ids", []):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this page.",
        )
    todo_pages_collection.update_one(
        {"_id": page["_id"]},
        {"$pull": {"member_ids": member_oid}, "$set": {"updated_at": utcnow()}},
    )
    # Unassign any tasks on this page that were assigned to the removed member.
    todos_collection.update_many(
        {"page_id": page["_id"], "assigned_to": member_oid},
        {"$set": {"assigned_to": None, "updated_at": utcnow()}},
    )


def list_members(page: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Owner first (role=owner), then every member (role=member)."""
    owner = users_collection.find_one({"_id": page["owner_id"]})
    result: List[Dict[str, Any]] = []
    if owner:
        result.append(serialize_member(owner, "owner"))
    member_ids = page.get("member_ids", [])
    if member_ids:
        for user in users_collection.find({"_id": {"$in": member_ids}}):
            result.append(serialize_member(user, "member"))
    return result


def build_page_response(
    page: Dict[str, Any],
    current_user: Dict[str, Any],
    include_todo_count: bool = False,
) -> Dict[str, Any]:
    owner = users_collection.find_one({"_id": page["owner_id"]})
    members = list_members(page)
    role = "owner" if page["owner_id"] == current_user["_id"] else "member"
    todo_count = (
        todos_collection.count_documents({"page_id": page["_id"]})
        if include_todo_count
        else None
    )
    return serialize_page(
        page, owner=owner, members=members, role=role, todo_count=todo_count
    )
