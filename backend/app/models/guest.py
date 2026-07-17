import enum
import uuid
from datetime import date
from sqlalchemy import (
    String, Text, Boolean, ForeignKey, SmallInteger, Numeric, Date, LargeBinary,
    CheckConstraint, Enum as SQLAlchemyEnum
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin

class GuestType(str, enum.Enum):
    PERMANENT = "permanent"
    TEMPORARY = "temporary"

class StayUnit(str, enum.Enum):
    DAYS = "days"
    MONTHS = "months"
    YEARS = "years"

class FoodType(str, enum.Enum):
    VEG = "veg"
    NON_VEG = "non_veg"
    EGGETARIAN = "eggetarian"

class Guest(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "guests"

    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False)
    
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # SECURITY: This is not yet encrypted, pending future milestone. 
    # For now store the UTF-8 bytes of the plaintext value so the column shape and read/write path are correct.
    aadhar_number_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    aadhar_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    
    permanent_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    guest_type: Mapped[GuestType] = mapped_column(
        SQLAlchemyEnum(GuestType, name="guest_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=GuestType.PERMANENT,
        server_default="permanent"
    )
    
    stay_duration: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    stay_unit: Mapped[StayUnit | None] = mapped_column(
        SQLAlchemyEnum(StayUnit, name="stay_unit", values_callable=lambda obj: [e.value for e in obj]),
        nullable=True
    )
    
    monthly_rent: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    advance_paid: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    
    has_food: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    food_type: Mapped[FoodType | None] = mapped_column(
        SQLAlchemyEnum(FoodType, name="food_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=True
    )
    
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    
    joined_at: Mapped[date] = mapped_column(Date, nullable=False)
    moved_out_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        CheckConstraint('monthly_rent >= 0', name='chk_guests__monthly_rent'),
        CheckConstraint('advance_paid IS NULL OR advance_paid >= 0', name='chk_guests__advance_paid'),
        CheckConstraint('active = true OR moved_out_at IS NOT NULL', name='chk_guests__active_moved_out'),
    )
