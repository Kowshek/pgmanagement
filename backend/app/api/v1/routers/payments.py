import uuid
from datetime import date, datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.payment import PaymentCreateRequest, PaymentResponse
from app.services.payment_service import PaymentService
from app.repositories.payment_repository import PaymentRepository
from app.api.v1.deps import (
    get_payment_service, 
    get_payment_repo, 
    get_db, 
    require_role,
    require_property_member
)
from app.models.property_member import PropertyMember

router = APIRouter()

@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    property_id: uuid.UUID,
    request: PaymentCreateRequest,
    member: PropertyMember = Depends(require_role("staff")),
    payment_service: PaymentService = Depends(get_payment_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        payment = await payment_service.record_payment(
            property_id=property_id,
            guest_id=request.guest_id,
            amount=request.amount,
            method=request.method,
            for_month=request.for_month,
            idempotency_key=request.idempotency_key,
            recorded_by=member.user_id,
            notes=request.notes
        )
        await db.commit()
        return payment
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await db.rollback()
        raise

@router.get("", response_model=List[PaymentResponse])
async def list_payments(
    property_id: uuid.UUID,
    guest_id: uuid.UUID | None = Query(None),
    month: str | None = Query(None, description="YYYY-MM formatted month"),
    member: PropertyMember = Depends(require_property_member),
    payment_repo: PaymentRepository = Depends(get_payment_repo)
):
    for_month_date = None
    if month:
        try:
            # Safely parse YYYY-MM explicitly locking the date to the 1st
            parsed_date = datetime.strptime(month, "%Y-%m").date()
            for_month_date = date(parsed_date.year, parsed_date.month, 1)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                detail="month must be in YYYY-MM format"
            )
            
    payments = await payment_repo.list_by_property(
        property_id=property_id,
        guest_id=guest_id,
        for_month=for_month_date
    )
    return payments

@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    property_id: uuid.UUID,
    payment_id: uuid.UUID,
    member: PropertyMember = Depends(require_role("staff")),
    payment_repo: PaymentRepository = Depends(get_payment_repo),
    db: AsyncSession = Depends(get_db)
):
    payment = await payment_repo.get_by_id(payment_id)
    if not payment or payment.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
        
    await payment_repo.soft_delete(payment_id)
    await db.commit()
