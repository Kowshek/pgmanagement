import enum
import uuid
from datetime import date, datetime
from sqlalchemy import (
    String, Text, Boolean, ForeignKey, Numeric, Date, DateTime, Uuid,
    CheckConstraint, Enum as SQLAlchemyEnum, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin

class PaymentMethod(str, enum.Enum):
    UPI = "upi"
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"

class Payment(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "payments"

    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    guest_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guests.id", ondelete="RESTRICT"), nullable=False)
    
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        SQLAlchemyEnum(PaymentMethod, name="payment_method", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False
    )
    
    for_month: Mapped[date] = mapped_column(Date, nullable=False)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    idempotency_key: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_payments__amount_positive'),
        CheckConstraint("date_trunc('month', for_month) = for_month", name='chk_payments__for_month_first_day'),
        UniqueConstraint('property_id', 'idempotency_key', name='uq_payments__property_id_idempotency_key'),
    )
