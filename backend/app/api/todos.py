from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, status

from app.dependencies.auth import (
    get_current_user,
    require_page_access,
    require_todo_access,
)
from app.schemas.todo import (
    ReorderRequest,
    TodoCreateRequest,
    TodoResponse,
    TodoUpdateRequest,
)
from app.services import todo_service

router = APIRouter(prefix="/api", tags=["todos"])


@router.post(
    "/pages/{page_id}/todos",
    status_code=status.HTTP_201_CREATED,
    response_model=TodoResponse,
)
def create_todo(
    data: TodoCreateRequest,
    page: Dict[str, Any] = Depends(require_page_access),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    todo = todo_service.create_todo(page, current_user, data)
    return todo_service.serialize_one(todo)


@router.get("/pages/{page_id}/todos", response_model=List[TodoResponse])
def list_todos(page: Dict[str, Any] = Depends(require_page_access)):
    todos = todo_service.list_todos(page)
    return todo_service.serialize_many(todos)


@router.patch("/pages/{page_id}/todos/reorder", response_model=List[TodoResponse])
def reorder_todos(
    data: ReorderRequest,
    page: Dict[str, Any] = Depends(require_page_access),
):
    todos = todo_service.reorder_todos(page, data.task_ids)
    return todo_service.serialize_many(todos)


@router.get("/todos/due", response_model=List[TodoResponse])
def list_due_todos(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Incomplete todos with a due date across all pages the user can access.

    Powers the frontend reminder system (overdue / due-today alerts).
    NOTE: declared before /todos/{todo_id} so "due" is not parsed as an id.
    """
    docs, pages_by_id = todo_service.list_due_todos(current_user)
    return todo_service.serialize_due(docs, pages_by_id)


@router.get("/todos/{todo_id}", response_model=TodoResponse)
def get_todo(
    todo_and_page: Tuple[Dict[str, Any], Dict[str, Any]] = Depends(require_todo_access)
):
    todo, _page = todo_and_page
    return todo_service.serialize_one(todo)


@router.patch("/todos/{todo_id}", response_model=TodoResponse)
def update_todo(
    data: TodoUpdateRequest,
    todo_and_page: Tuple[Dict[str, Any], Dict[str, Any]] = Depends(require_todo_access),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    todo, page = todo_and_page
    updated = todo_service.update_todo(todo, page, current_user, data)
    return todo_service.serialize_one(updated)


@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_and_page: Tuple[Dict[str, Any], Dict[str, Any]] = Depends(require_todo_access)
):
    todo, _page = todo_and_page
    todo_service.delete_todo(todo)
    return None
