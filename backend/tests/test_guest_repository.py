import pytest
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.property import Property
from app.models.room import Room, RoomType
from app.repositories.guest_repository import GuestRepository

async def setup_base_data(db_session: AsyncSession):
    owner = User(id=uuid.uuid4(), email="guest_repo@example.com", password_hash="hash", full_name="Owner", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Guest Repo Prop")
    db_session.add(prop)
    
    room_1 = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.SINGLE, capacity=1)
    room_2 = Room(id=uuid.uuid4(), property_id=prop.id, room_number="102", room_type=RoomType.DOUBLE, capacity=2)
    db_session.add(room_1)
    db_session.add(room_2)
    
    await db_session.flush()
    return prop.id, room_1.id, room_2.id

@pytest.mark.asyncio
async def test_guest_repository_crud(db_session: AsyncSession):
    prop_id, room_1_id, room_2_id = await setup_base_data(db_session)
    repo = GuestRepository(db_session)
    
    # 1. Create
    guest = await repo.create(
        id=uuid.uuid4(),
        property_id=prop_id,
        room_id=room_1_id,
        full_name="John Doe",
        phone="9876543210",
        monthly_rent=5000.00,
        joined_at=date(2026, 1, 1),
        active=True
    )
    assert guest.id is not None
    
    # 2. Get by ID
    fetched = await repo.get_by_id(guest.id)
    assert fetched is not None
    assert fetched.full_name == "John Doe"
    
    # 3. Update
    updated = await repo.update(guest.id, full_name="John Smith", monthly_rent=5500.00)
    assert updated is not None
    assert updated.full_name == "John Smith"
    
    # 4. Soft Delete
    await repo.soft_delete(guest.id)
    
    # 5. Confirm Get ignores soft deleted
    deleted = await repo.get_by_id(guest.id)
    assert deleted is None
    
@pytest.mark.asyncio
async def test_guest_repository_list_filters(db_session: AsyncSession):
    prop_id, room_1_id, room_2_id = await setup_base_data(db_session)
    repo = GuestRepository(db_session)
    
    # Create Guests
    g1 = await repo.create(
        id=uuid.uuid4(), property_id=prop_id, room_id=room_1_id,
        full_name="Alice Wonderland", phone="1111111111", monthly_rent=5000.0, joined_at=date(2026,1,1), active=True
    )
    g2 = await repo.create(
        id=uuid.uuid4(), property_id=prop_id, room_id=room_2_id,
        full_name="Bob Builder", phone="2222222222", monthly_rent=6000.0, joined_at=date(2026,2,1), active=True
    )
    g3 = await repo.create(
        id=uuid.uuid4(), property_id=prop_id, room_id=room_1_id,
        full_name="Charlie Chaplin", phone="3333333333", monthly_rent=4000.0, joined_at=date(2026,3,1), 
        active=False, moved_out_at=date(2026,4,1)
    )
    
    # 1. No filters
    results = await repo.list_by_property(prop_id)
    assert len(results) == 3
    
    # 2. Filter by active=True
    results = await repo.list_by_property(prop_id, active=True)
    assert len(results) == 2
    assert {r.full_name for r in results} == {"Alice Wonderland", "Bob Builder"}
    
    # 3. Filter by active=False
    results = await repo.list_by_property(prop_id, active=False)
    assert len(results) == 1
    assert results[0].full_name == "Charlie Chaplin"
    
    # 4. Filter by room_id
    results = await repo.list_by_property(prop_id, room_id=room_2_id)
    assert len(results) == 1
    assert results[0].full_name == "Bob Builder"
    
    # 5. Filter by search (name)
    results = await repo.list_by_property(prop_id, search="alice")
    assert len(results) == 1
    assert results[0].full_name == "Alice Wonderland"
    
    # 6. Filter by search (phone partial)
    results = await repo.list_by_property(prop_id, search="222")
    assert len(results) == 1
    assert results[0].full_name == "Bob Builder"
    
    # 7. Filter Combined (active=True, room_id=room_1, search="alice")
    results = await repo.list_by_property(prop_id, active=True, room_id=room_1_id, search="alice")
    assert len(results) == 1
    assert results[0].id == g1.id
    
    # 8. Filter Combined mapping to None (active=True, room_id=room_2, search="alice")
    results = await repo.list_by_property(prop_id, active=True, room_id=room_2_id, search="alice")
    assert len(results) == 0
