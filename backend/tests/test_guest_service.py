import pytest
import uuid
import asyncio
from datetime import date
from unittest.mock import AsyncMock

from app.services.guest_service import GuestService
from app.models.room import Room, RoomType
from app.models.guest import Guest, GuestType
from app.core.exceptions import RoomFullError
from app.db.session import async_session_maker

@pytest.mark.asyncio
async def test_add_guest_validation_errors():
    guest_repo = AsyncMock()
    room_repo = AsyncMock()
    service = GuestService(guest_repo, room_repo)
    
    # Invalid phone format
    with pytest.raises(ValueError, match="phone"):
        await service.add_guest(
            uuid.uuid4(), uuid.uuid4(), "Test", "inv@lid", 1000, date(2026,1,1)
        )
        
    # Invalid negative rent
    with pytest.raises(ValueError, match="monthly_rent"):
        await service.add_guest(
            uuid.uuid4(), uuid.uuid4(), "Test", "1234567890", -10, date(2026,1,1)
        )
        
    # Invalid negative advance
    with pytest.raises(ValueError, match="advance_paid"):
        await service.add_guest(
            uuid.uuid4(), uuid.uuid4(), "Test", "1234567890", 1000, date(2026,1,1), advance_paid=-500
        )

@pytest.mark.asyncio
async def test_add_guest_concurrency(db_session):
    from app.repositories.guest_repository import GuestRepository
    from app.repositories.room_repository import RoomRepository
    from app.models.user import User
    from app.models.property import Property
    
    owner = User(id=uuid.uuid4(), email="concur_guest@ex.com", password_hash="h", full_name="O", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Concur Prop")
    db_session.add(prop)
    
    # Room with exactly 1 capacity
    room = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room)
    await db_session.commit()
    
    # To test actual PostgreSQL FOR UPDATE concurrency locks without deadlocking Pytest,
    # we explicitly orchestrate two completely independent asynchronous session factories.
    async def create_task(name):
        async with async_session_maker() as session:
            svc = GuestService(GuestRepository(session), RoomRepository(session))
            try:
                await svc.add_guest(
                    property_id=prop.id,
                    room_id=room.id,
                    full_name=name,
                    phone="1234567890",
                    monthly_rent=5000,
                    joined_at=date(2026,1,1)
                )
                await session.commit()
                return "SUCCESS"
            except RoomFullError:
                await session.rollback()
                return "ROOM_FULL"
            except Exception as e:
                await session.rollback()
                return str(e)
                
    results = await asyncio.gather(
        create_task("Task 1"),
        create_task("Task 2")
    )
    
    # We guarantee EXACTLY ONE succeeds and EXACTLY ONE fails citing capacity due to row lock ordering
    assert "SUCCESS" in results
    assert "ROOM_FULL" in results
    assert results.count("SUCCESS") == 1
    assert results.count("ROOM_FULL") == 1
