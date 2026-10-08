from typing import Any, Dict, Tuple

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.db.mongodb import todo_pages_collection, todos_collection, users_collection
from app.models import to_object_id

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

_UNAUTHORIZED_HEADERS = {"WWW-Authenticate": "Bearer"}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """Validate the JWT and load the authenticated user document."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers=_UNAUTHORIZED_HEADERS,
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers=_UNAUTHORIZED_HEADERS,
        )
    user = users_collection.find_one({"_id": to_object_id(payload["sub"], "Invalid token.")})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
            headers=_UNAUTHORIZED_HEADERS,
        )
    return user


def _assert_page_access(page: Dict[str, Any], user: Dict[str, Any]) -> None:
    user_id = user["_id"]
    if user_id != page["owner_id"] and user_id not in page.get("member_ids", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this page.",
        )


def require_page_access(
    page_id: str, current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Load a page and ensure the current user owns it or is a member."""
    page = todo_pages_collection.find_one({"_id": to_object_id(page_id, "Invalid page id.")})
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo page not found."
        )
    _assert_page_access(page, current_user)
    return page


def require_page_owner(
    page: Dict[str, Any] = Depends(require_page_access),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Ensure the current user is the owner of the page."""
    if page["owner_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the page owner can perform this action.",
        )
    return page


def require_todo_access(
    todo_id: str, current_user: Dict[str, Any] = Depends(get_current_user)
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Load a todo plus its page and ensure the user can access the page."""
    todo = todos_collection.find_one({"_id": to_object_id(todo_id, "Invalid todo id.")})
    if not todo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found."
        )
    page = todo_pages_collection.find_one({"_id": todo["page_id"]})
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo page not found."
        )
    _assert_page_access(page, current_user)
    return todo, page
