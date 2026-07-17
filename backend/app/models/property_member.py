import enum
import uuid
from datetime import datetime
from sqlalchemy import Enum as SQLAlchemyEnum, ForeignKey, Boolean, UniqueConstraint, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

class PropertyRole(str, enum.Enum):
    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"

class PropertyMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "property_members"

    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    role: Mapped[PropertyRole] = mapped_column(
        SQLAlchemyEnum(PropertyRole, name="property_role", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False
    )
    
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    __table_args__ = (
        UniqueConstraint('property_id', 'user_id', name='uq_property_members__property_id_user_id'),
    )
