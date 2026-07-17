import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.property import Property
from app.models.room import RoomType
from app.repositories.room_repository import RoomRepository

async def test_room_repository_crud(db_session: AsyncSession):
    # Setup base entities
    owner = User(id=uuid.uuid4(), email="repo_owner@ex.com", password_hash="h", full_name="O", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Repo Prop")
    db_session.add(prop)
    await db_session.flush()
    
    repo = RoomRepository(db_session)
    
    # 1. Test create
    room = await repo.create(
        id=uuid.uuid4(),
        property_id=prop.id,
        room_number="101",
        room_type=RoomType.DOUBLE,
        capacity=2
    )
    assert room.id is not None
    assert room.room_number == "101"
    
    # 2. Test get_by_id
    fetched_room = await repo.get_by_id(room.id)
    assert fetched_room is not None
    assert fetched_room.room_number == "101"
    
    # 3. Test update
    updated_room = await repo.update(room.id, capacity=3, room_type=RoomType.TRIPLE)
    assert updated_room is not None
    assert updated_room.capacity == 3
    assert updated_room.room_type == RoomType.TRIPLE
    
    # 4. Test list_by_property
    room_2 = await repo.create(
        id=uuid.uuid4(),
        property_id=prop.id,
        room_number="102",
        room_type=RoomType.SINGLE,
        capacity=1
    )
    rooms = await repo.list_by_property(prop.id)
    assert len(rooms) == 2
    
    # 5. Test soft_delete
    await repo.soft_delete(room.id)
    
    # 6. Verify get_by_id excludes soft_deleted
    deleted_room = await repo.get_by_id(room.id)
    assert deleted_room is None
    
    # 7. Verify list_by_property excludes soft_deleted
    rooms_after_delete = await repo.list_by_property(prop.id)
    assert len(rooms_after_delete) == 1
    assert rooms_after_delete[0].id == room_2.id
