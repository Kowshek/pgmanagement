import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.payment import PaymentMethod

class PaymentCreateRequest(BaseModel):
    guest_id: uuid.UUID
    amount: float = Field(..., gt=0)
    method: PaymentMethod
    for_month: date
    idempotency_key: uuid.UUID
    notes: str | None = None

class PaymentResponse(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    guest_id: uuid.UUID
    amount: float
    method: PaymentMethod
    for_month: date
    paid_at: datetime
    recorded_by: uuid.UUID | None
    idempotency_key: uuid.UUID
    notes: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
