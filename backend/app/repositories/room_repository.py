import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.room import Room

class RoomRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **fields: Any) -> Room:
        room = Room(**fields)
        self.session.add(room)
        await self.session.flush()
        return room

    async def get_by_id(self, room_id: uuid.UUID) -> Room | None:
        stmt = select(Room).where(
            Room.id == room_id,
            Room.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
        
    async def get_by_id_for_update(self, room_id: uuid.UUID) -> Room | None:
        stmt = select(Room).where(
            Room.id == room_id,
            Room.deleted_at.is_(None)
        ).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_property_and_number(self, property_id: uuid.UUID, room_number: str) -> Room | None:
        stmt = select(Room).where(
            Room.property_id == property_id,
            Room.room_number == room_number,
            Room.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_property(self, property_id: uuid.UUID) -> list[Room]:
        stmt = select(Room).where(
            Room.property_id == property_id,
            Room.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update(self, room_id: uuid.UUID, **fields: Any) -> Room | None:
        stmt = (
            update(Room)
            .where(Room.id == room_id, Room.deleted_at.is_(None))
            .values(**fields)
            .returning(Room)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.scalar_one_or_none()

    async def soft_delete(self, room_id: uuid.UUID) -> None:
        stmt = (
            update(Room)
            .where(Room.id == room_id, Room.deleted_at.is_(None))
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await self.session.execute(stmt)
        await self.session.flush()
