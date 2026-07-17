import pytest
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.property import Property
from app.models.room import Room, RoomType
from app.models.guest import Guest, GuestType
from app.models.payment import Payment, PaymentMethod

@pytest.fixture
async def setup_payment_dependencies(db_session: AsyncSession):
    owner = User(id=uuid.uuid4(), email="payment_db@example.com", password_hash="hash", full_name="Owner", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Payment Prop")
    db_session.add(prop)
    await db_session.flush()  # same ordering issue: prop must exist before room FK-references it

    room = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room)
    await db_session.flush()  # same ordering issue: room must exist before guest FK-references it

    guest = Guest(
        id=uuid.uuid4(),
        property_id=prop.id,
        room_id=room.id,
        full_name="Payment Guest",
        phone="1234567890",
        monthly_rent=5000.00,
        joined_at=date(2026, 1, 1),
        active=True
    )
    db_session.add(guest)
    
    await db_session.flush()
    return {"prop_id": prop.id, "guest_id": guest.id}

@pytest.mark.asyncio
async def test_payment_amount_zero_rejected(db_session: AsyncSession, setup_payment_dependencies):
    deps = setup_payment_dependencies
    
    payment = Payment(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        guest_id=deps["guest_id"],
        amount=0,  # Invalid
        method=PaymentMethod.UPI,
        for_month=date(2026, 7, 1),
        idempotency_key=uuid.uuid4()
    )
    db_session.add(payment)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

@pytest.mark.asyncio
async def test_payment_amount_negative_rejected(db_session: AsyncSession, setup_payment_dependencies):
    deps = setup_payment_dependencies
    
    payment = Payment(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        guest_id=deps["guest_id"],
        amount=-500.00,  # Invalid
        method=PaymentMethod.CASH,
        for_month=date(2026, 7, 1),
        idempotency_key=uuid.uuid4()
    )
    db_session.add(payment)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

@pytest.mark.asyncio
async def test_payment_for_month_not_first_day_rejected(db_session: AsyncSession, setup_payment_dependencies):
    deps = setup_payment_dependencies
    
    payment = Payment(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        guest_id=deps["guest_id"],
        amount=5000.00,
        method=PaymentMethod.BANK_TRANSFER,
        for_month=date(2026, 7, 15),  # Invalid: not 1st of month
        idempotency_key=uuid.uuid4()
    )
    db_session.add(payment)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()

@pytest.mark.asyncio
async def test_payment_for_month_first_day_accepted(db_session: AsyncSession, setup_payment_dependencies):
    deps = setup_payment_dependencies
    
    payment = Payment(
        id=uuid.uuid4(),
        property_id=deps["prop_id"],
        guest_id=deps["guest_id"],
        amount=5000.00,
        method=PaymentMethod.BANK_TRANSFER,
        for_month=date(2026, 7, 1),  # Valid: 1st of month
        idempotency_key=uuid.uuid4()
    )
    db_session.add(payment)
    await db_session.flush()
    assert payment.id is not None
    await db_session.commit()

@pytest.mark.asyncio
async def test_payment_idempotency_key_duplicate_rejected(db_session: AsyncSession, setup_payment_dependencies):
    deps = setup_payment_dependencies
    idemp_key = uuid.uuid4()
    
    payment1 = Payment(
        id=uuid.uuid4(), property_id=deps["prop_id"], guest_id=deps["guest_id"],
        amount=5000.00, method=PaymentMethod.UPI, for_month=date(2026, 7, 1),
        idempotency_key=idemp_key
    )
    db_session.add(payment1)
    await db_session.flush()
    
    # Attempting to submit a second payment under the exact same idempotency key for the property
    payment2 = Payment(
        id=uuid.uuid4(), property_id=deps["prop_id"], guest_id=deps["guest_id"],
        amount=6000.00, method=PaymentMethod.UPI, for_month=date(2026, 8, 1),
        idempotency_key=idemp_key
    )
    db_session.add(payment2)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()
