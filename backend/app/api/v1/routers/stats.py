import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.schemas.stats import DashboardStats
from app.services.stats_service import StatsService
from app.api.v1.deps import get_stats_service, require_property_member
from app.models.property_member import PropertyMember

router = APIRouter()

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    property_id: uuid.UUID,
    month: str | None = Query(None, description="YYYY-MM formatted month"),
    member: PropertyMember = Depends(require_property_member),
    stats_service: StatsService = Depends(get_stats_service)
):
    target_month = None
    if month:
        try:
            parsed_date = datetime.strptime(month, "%Y-%m").date()
            target_month = date(parsed_date.year, parsed_date.month, 1)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                detail="month must be in YYYY-MM format"
            )
    else:
        # Securely default to the server's truth of the current exact month frame
        target_month = date.today().replace(day=1)
        
    stats = await stats_service.dashboard_stats(property_id=property_id, month=target_month)
    return stats
