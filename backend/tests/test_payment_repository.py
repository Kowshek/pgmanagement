import pytest
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.property import Property
from app.models.room import Room, RoomType
from app.models.guest import Guest, GuestType
from app.models.payment import PaymentMethod
from app.repositories.payment_repository import PaymentRepository

async def setup_base_data(db_session: AsyncSession):
    owner = User(id=uuid.uuid4(), email="payment_repo@example.com", password_hash="hash", full_name="Owner", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Payment Repo Prop")
    db_session.add(prop)
    await db_session.flush()  # same ordering issue: prop must exist before room FK-references it

    room = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room)
    await db_session.flush()  # same ordering issue: room must exist before guest FK-references it

    guest1 = Guest(
        id=uuid.uuid4(), property_id=prop.id, room_id=room.id,
        full_name="Guest One", phone="1234567890", monthly_rent=5000.00,
        joined_at=date(2026, 1, 1), active=True
    )
    guest2 = Guest(
        id=uuid.uuid4(), property_id=prop.id, room_id=room.id,
        full_name="Guest Two", phone="0987654321", monthly_rent=6000.00,
        joined_at=date(2026, 2, 1), active=True
    )
    db_session.add(guest1)
    db_session.add(guest2)
    
    await db_session.flush()
    return prop.id, guest1.id, guest2.id

@pytest.mark.asyncio
async def test_payment_repository_crud(db_session: AsyncSession):
    prop_id, guest1_id, guest2_id = await setup_base_data(db_session)
    repo = PaymentRepository(db_session)
    idemp_key = uuid.uuid4()
    
    # 1. Create
    payment = await repo.create(
        id=uuid.uuid4(),
        property_id=prop_id,
        guest_id=guest1_id,
        amount=5000.00,
        method=PaymentMethod.UPI,
        for_month=date(2026, 7, 1),
        idempotency_key=idemp_key,
        notes="Rent for July"
    )
    assert payment.id is not None
    
    # 2. Get by ID
    fetched = await repo.get_by_id(payment.id)
    assert fetched is not None
    assert fetched.amount == 5000.00
    
    # 3. Get by Idempotency Key
    fetched_by_idemp = await repo.get_by_idempotency_key(prop_id, idemp_key)
    assert fetched_by_idemp is not None
    assert fetched_by_idemp.id == payment.id
    
    # 4. Soft Delete
    await repo.soft_delete(payment.id)
    
    # 5. Confirm Get ignores soft deleted
    deleted = await repo.get_by_id(payment.id)
    assert deleted is None
    deleted_idemp = await repo.get_by_idempotency_key(prop_id, idemp_key)
    assert deleted_idemp is None

@pytest.mark.asyncio
async def test_payment_repository_list_filters(db_session: AsyncSession):
    prop_id, guest1_id, guest2_id = await setup_base_data(db_session)
    repo = PaymentRepository(db_session)
    
    # Create Payments
    p1 = await repo.create(
        id=uuid.uuid4(), property_id=prop_id, guest_id=guest1_id, amount=5000.0,
        method=PaymentMethod.UPI, for_month=date(2026, 7, 1), idempotency_key=uuid.uuid4()
    )
    p2 = await repo.create(
        id=uuid.uuid4(), property_id=prop_id, guest_id=guest1_id, amount=5000.0,
        method=PaymentMethod.CASH, for_month=date(2026, 8, 1), idempotency_key=uuid.uuid4()
    )
    p3 = await repo.create(
        id=uuid.uuid4(), property_id=prop_id, guest_id=guest2_id, amount=6000.0,
        method=PaymentMethod.CARD, for_month=date(2026, 7, 1), idempotency_key=uuid.uuid4()
    )
    
    # 1. No filters (all for property)
    results = await repo.list_by_property(prop_id)
    assert len(results) == 3
    
    # 2. Filter by guest_id
    results_guest1 = await repo.list_by_property(prop_id, guest_id=guest1_id)
    assert len(results_guest1) == 2
    assert {r.id for r in results_guest1} == {p1.id, p2.id}
    
    # 3. Filter by for_month
    results_july = await repo.list_by_property(prop_id, for_month=date(2026, 7, 1))
    assert len(results_july) == 2
    assert {r.id for r in results_july} == {p1.id, p3.id}
    
    # 4. Filter Combined
    results_combo = await repo.list_by_property(prop_id, guest_id=guest2_id, for_month=date(2026, 7, 1))
    assert len(results_combo) == 1
    assert results_combo[0].id == p3.id
