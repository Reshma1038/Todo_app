from typing import Any, Dict, List

from fastapi import APIRouter, Depends, status

from app.dependencies.auth import (
    get_current_user,
    require_page_access,
    require_page_owner,
)
from app.schemas.todo_page import (
    MemberAddRequest,
    MemberResponse,
    PageCreateRequest,
    PageResponse,
    PageUpdateRequest,
)
from app.services import page_service

router = APIRouter(prefix="/api/pages", tags=["pages"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PageResponse)
def create_page(
    data: PageCreateRequest, current_user: Dict[str, Any] = Depends(get_current_user)
):
    page = page_service.create_page(current_user["_id"], data.title)
    return page_service.build_page_response(page, current_user)


@router.get("", response_model=List[PageResponse])
def list_pages(current_user: Dict[str, Any] = Depends(get_current_user)):
    pages = page_service.list_pages_for_user(current_user["_id"])
    return [
        page_service.build_page_response(page, current_user, include_todo_count=True)
        for page in pages
    ]


@router.get("/{page_id}", response_model=PageResponse)
def get_page(
    page: Dict[str, Any] = Depends(require_page_access),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return page_service.build_page_response(page, current_user)


@router.patch("/{page_id}", response_model=PageResponse)
def rename_page(
    data: PageUpdateRequest,
    page: Dict[str, Any] = Depends(require_page_owner),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    updated = page_service.rename_page(page, data.title)
    return page_service.build_page_response(updated, current_user)


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page(page: Dict[str, Any] = Depends(require_page_owner)):
    page_service.delete_page(page)
    return None


# ---------------------------------------------------------------- members ---


@router.post(
    "/{page_id}/members",
    status_code=status.HTTP_201_CREATED,
    response_model=List[MemberResponse],
)
def add_member(
    data: MemberAddRequest,
    page: Dict[str, Any] = Depends(require_page_owner),
):
    """Share the page with an already-registered user (by email)."""
    page_service.add_member_by_email(page, data.email)
    refreshed = page_service.get_page(page["_id"])
    return page_service.list_members(refreshed)


@router.get("/{page_id}/members", response_model=List[MemberResponse])
def get_members(page: Dict[str, Any] = Depends(require_page_access)):
    return page_service.list_members(page)


@router.delete(
    "/{page_id}/members/{user_id}",
    status_code=status.HTTP_200_OK,
    response_model=List[MemberResponse],
)
def remove_member(
    user_id: str,
    page: Dict[str, Any] = Depends(require_page_owner),
):
    page_service.remove_member(page, user_id)
    refreshed = page_service.get_page(page["_id"])
    return page_service.list_members(refreshed)
