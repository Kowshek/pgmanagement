import enum
import uuid
from sqlalchemy import (
    String, Text, Boolean, ForeignKey, SmallInteger, Numeric,
    CheckConstraint, Index, text, Enum as SQLAlchemyEnum
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin

class RoomType(str, enum.Enum):
    SINGLE = "single"
    DOUBLE = "double"
    TRIPLE = "triple"
    QUAD = "quad"
    CUSTOM = "custom"

class Room(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "rooms"

    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    
    room_type: Mapped[RoomType] = mapped_column(
        SQLAlchemyEnum(RoomType, name="room_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False
    )
    custom_type_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    capacity: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_ac: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    advance_details: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        CheckConstraint('capacity BETWEEN 1 AND 20', name='chk_rooms__capacity'),
        Index(
            'ix_rooms__property_id_room_number_unique',
            'property_id',
            'room_number',
            unique=True,
            postgresql_where=text('deleted_at IS NULL')
        ),
    )
