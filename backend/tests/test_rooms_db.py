import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.property import Property
from app.models.room import Room, RoomType

async def test_room_capacity_constraints(db_session: AsyncSession):
    # Setup base entities
    owner = User(id=uuid.uuid4(), email="room_owner@example.com", password_hash="hash", full_name="Owner", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Constraint Prop")
    db_session.add(prop)
    # commit (not flush): under join_transaction_mode="create_savepoint",
    # db_session.rollback() below rolls back to the CURRENT savepoint. Since
    # commit() releases the current savepoint and opens a fresh one, owner
    # and prop survive the later rollbacks that undo the deliberately-invalid
    # room inserts. A plain flush() would leave them in the same savepoint as
    # the failed inserts, so rollback() would wipe them out too.
    await db_session.commit()
    # Capture the plain UUID now: session.rollback() below unconditionally
    # expires every ORM object it's tracking (independent of savepoint
    # depth), so re-reading prop.id after any rollback forces a synchronous
    # lazy-reload outside an async context and crashes with
    # sqlalchemy.exc.MissingGreenlet.
    prop_id = prop.id

    # 1. Capacity = 0 raises IntegrityError
    room_0 = Room(id=uuid.uuid4(), property_id=prop_id, room_number="0", room_type=RoomType.SINGLE, capacity=0)
    db_session.add(room_0)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

    # 2. Capacity = 21 raises IntegrityError
    room_21 = Room(id=uuid.uuid4(), property_id=prop_id, room_number="21", room_type=RoomType.SINGLE, capacity=21)
    db_session.add(room_21)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

    # 3. Capacity = 1 succeeds
    room_1 = Room(id=uuid.uuid4(), property_id=prop_id, room_number="1", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room_1)
    await db_session.flush()

    # 4. Capacity = 20 succeeds
    room_20 = Room(id=uuid.uuid4(), property_id=prop_id, room_number="20", room_type=RoomType.SINGLE, capacity=20)
    db_session.add(room_20)
    await db_session.flush()

async def test_room_partial_unique_index(db_session: AsyncSession):
    owner = User(id=uuid.uuid4(), email="room_index@example.com", password_hash="hash", full_name="Owner", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Index Prop")
    db_session.add(prop)
    await db_session.flush()
    
    # 1. Create a room
    room_active_1 = Room(
        id=uuid.uuid4(),
        property_id=prop.id, 
        room_number="101", 
        room_type=RoomType.DOUBLE, 
        capacity=2
    )
    db_session.add(room_active_1)
    await db_session.flush()
    
    # 2. Soft-delete it
    room_active_1.deleted_at = datetime.now(timezone.utc)
    await db_session.flush()
    
    # 3. Create a NEW active room with the same number (should succeed!)
    room_active_2 = Room(
        id=uuid.uuid4(),
        property_id=prop.id, 
        room_number="101", 
        room_type=RoomType.SINGLE, 
        capacity=1
    )
    db_session.add(room_active_2)
    await db_session.flush()
    
    # 4. Create a SECOND active room with the same number (should fail!)
    room_active_3 = Room(
        id=uuid.uuid4(),
        property_id=prop.id, 
        room_number="101", 
        room_type=RoomType.TRIPLE, 
        capacity=3
    )
    db_session.add(room_active_3)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()
