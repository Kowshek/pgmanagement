import pytest
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.property import Property
from app.models.room import Room, RoomType
from app.models.guest import Guest, GuestType

@pytest.fixture
async def setup_guest_dependencies(db_session: AsyncSession):
    owner = User(id=uuid.uuid4(), email="guest_db@example.com", password_hash="hash", full_name="Owner", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Guest Prop")
    db_session.add(prop)
    
    room = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room)
    
    await db_session.flush()
    return {"prop_id": prop.id, "room_id": room.id}

@pytest.mark.asyncio
async def test_guest_negative_rent_rejected(db_session: AsyncSession, setup_guest_dependencies):
    deps = setup_guest_dependencies
    
    guest = Guest(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        room_id=deps["room_id"],
        full_name="John Doe",
        phone="1234567890",
        monthly_rent=-1000.00,  # Invalid: rent < 0
        joined_at=date(2026, 1, 1)
    )
    db_session.add(guest)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

@pytest.mark.asyncio
async def test_guest_negative_advance_rejected(db_session: AsyncSession, setup_guest_dependencies):
    deps = setup_guest_dependencies
    
    guest = Guest(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        room_id=deps["room_id"],
        full_name="John Doe",
        phone="1234567890",
        monthly_rent=5000.00,
        advance_paid=-500.00,  # Invalid: advance < 0
        joined_at=date(2026, 1, 1)
    )
    db_session.add(guest)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

@pytest.mark.asyncio
async def test_guest_active_false_without_moved_out_rejected(db_session: AsyncSession, setup_guest_dependencies):
    deps = setup_guest_dependencies
    
    guest = Guest(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        room_id=deps["room_id"],
        full_name="John Doe",
        phone="1234567890",
        monthly_rent=5000.00,
        joined_at=date(2026, 1, 1),
        active=False,
        moved_out_at=None  # Invalid: inactive without move out date
    )
    db_session.add(guest)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

@pytest.mark.asyncio
async def test_guest_active_false_with_moved_out_accepted(db_session: AsyncSession, setup_guest_dependencies):
    deps = setup_guest_dependencies
    
    guest = Guest(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        room_id=deps["room_id"],
        full_name="John Doe",
        phone="1234567890",
        monthly_rent=5000.00,
        joined_at=date(2026, 1, 1),
        active=False,
        moved_out_at=date(2026, 6, 1)  # Valid
    )
    db_session.add(guest)
    await db_session.flush()
    assert guest.id is not None
