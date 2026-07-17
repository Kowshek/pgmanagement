import uuid
from typing import Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property_member import PropertyMember, PropertyRole

class PropertyMemberRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **fields: Any) -> PropertyMember:
        member = PropertyMember(**fields)
        self.session.add(member)
        await self.session.flush()
        return member

    async def get_by_property_and_user(self, property_id: uuid.UUID, user_id: uuid.UUID) -> PropertyMember | None:
        stmt = select(PropertyMember).where(
            PropertyMember.property_id == property_id,
            PropertyMember.user_id == user_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_property(self, property_id: uuid.UUID, active_only: bool = True) -> list[PropertyMember]:
        stmt = select(PropertyMember).where(PropertyMember.property_id == property_id)
        if active_only:
            stmt = stmt.where(PropertyMember.is_active == True)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_role(self, member_id: uuid.UUID, new_role: PropertyRole) -> None:
        stmt = update(PropertyMember).where(
            PropertyMember.id == member_id
        ).values(role=new_role)
        await self.session.execute(stmt)
        await self.session.flush()

    async def deactivate(self, member_id: uuid.UUID) -> None:
        stmt = update(PropertyMember).where(
            PropertyMember.id == member_id
        ).values(is_active=False)
        await self.session.execute(stmt)
        await self.session.flush()
