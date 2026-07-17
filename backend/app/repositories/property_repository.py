import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property import Property
from app.models.property_member import PropertyMember

class PropertyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **fields: Any) -> Property:
        prop = Property(**fields)
        self.session.add(prop)
        await self.session.flush()
        return prop

    async def get_by_id(self, property_id: uuid.UUID) -> Property | None:
        stmt = select(Property).where(
            Property.id == property_id,
            Property.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: uuid.UUID) -> list[Property]:
        stmt = (
            select(Property)
            .join(PropertyMember, Property.id == PropertyMember.property_id)
            .where(
                PropertyMember.user_id == user_id,
                PropertyMember.is_active == True,
                Property.deleted_at.is_(None)
            )
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update(self, property_id: uuid.UUID, **fields: Any) -> Property | None:
        stmt = (
            update(Property)
            .where(Property.id == property_id, Property.deleted_at.is_(None))
            .values(**fields)
            .returning(Property)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.scalar_one_or_none()

    async def soft_delete(self, property_id: uuid.UUID) -> None:
        stmt = (
            update(Property)
            .where(Property.id == property_id, Property.deleted_at.is_(None))
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await self.session.execute(stmt)
        await self.session.flush()
