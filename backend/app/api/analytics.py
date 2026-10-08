from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.schemas.analytics import AnalyticsSummary
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def summary(
    page_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Performance analytics across all tasks the user can access
    (or a single page when `page_id` is given)."""
    return analytics_service.build_summary(current_user, page_id)
