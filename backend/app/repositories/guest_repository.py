import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.guest import Guest

class GuestRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **fields: Any) -> Guest:
        guest = Guest(**fields)
        self.session.add(guest)
        await self.session.flush()
        return guest

    async def get_by_id(self, guest_id: uuid.UUID) -> Guest | None:
        stmt = select(Guest).where(
            Guest.id == guest_id,
            Guest.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_property(
        self, 
        property_id: uuid.UUID, 
        active: bool | None = None, 
        room_id: uuid.UUID | None = None, 
        search: str | None = None
    ) -> list[Guest]:
        stmt = select(Guest).where(
            Guest.property_id == property_id,
            Guest.deleted_at.is_(None)
        )
        
        if active is not None:
            stmt = stmt.where(Guest.active == active)
            
        if room_id is not None:
            stmt = stmt.where(Guest.room_id == room_id)
            
        if search is not None:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Guest.full_name.ilike(search_term),
                    Guest.phone.ilike(search_term)
                )
            )
            
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update(self, guest_id: uuid.UUID, **fields: Any) -> Guest | None:
        stmt = (
            update(Guest)
            .where(Guest.id == guest_id, Guest.deleted_at.is_(None))
            .values(**fields)
            .returning(Guest)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.scalar_one_or_none()

    async def soft_delete(self, guest_id: uuid.UUID) -> None:
        stmt = (
            update(Guest)
            .where(Guest.id == guest_id, Guest.deleted_at.is_(None))
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await self.session.execute(stmt)
        await self.session.flush()
