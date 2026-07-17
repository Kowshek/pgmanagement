import pytest
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.property import Property
from app.models.room import Room, RoomType
from app.models.guest import Guest
from app.models.payment import Payment, PaymentMethod
from app.repositories.payment_repository import PaymentRepository
from app.repositories.guest_repository import GuestRepository
from app.services.payment_service import PaymentService
from app.services.rent_reconciliation import paid_for_month, balance_for_month

def test_rent_reconciliation_unit():
    # Setup Guest with precisely 10000 rent
    guest = Guest(id=uuid.uuid4(), monthly_rent=10000.00)
    
    # Target month
    target_date = date(2026, 7, 1)
    
    # Simulating standard mobile app split-payment flow:
    # 2 payments for target month (4000 and 3000), 1 historical (out-of-scope)
    payments = [
        Payment(id=uuid.uuid4(), amount=4000.00, for_month=target_date),
        Payment(id=uuid.uuid4(), amount=3000.00, for_month=target_date),
        Payment(id=uuid.uuid4(), amount=2000.00, for_month=date(2026, 8, 1))
    ]
    
    # Assert paid safely totals exclusively the in-scope month logic -> 7000
    paid = paid_for_month(payments, target_date)
    assert paid == 7000.0
    
    # Assert balance rigorously subtracts from rent correctly -> 3000
    balance = balance_for_month(guest, payments, target_date)
    assert balance == 3000.0

@pytest.fixture
async def setup_payment_integration(db_session: AsyncSession):
    owner = User(id=uuid.uuid4(), email="pay_service@ex.com", password_hash="h", full_name="O", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Pay Service Prop")
    db_session.add(prop)
    await db_session.flush()  # same ordering issue: prop must exist before room FK-references it

    room = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room)
    await db_session.flush()  # same ordering issue: room must exist before guest FK-references it

    guest = Guest(
        id=uuid.uuid4(), property_id=prop.id, room_id=room.id,
        full_name="Pay Guest", phone="1234567890", monthly_rent=5000.00,
        joined_at=date(2026, 1, 1), active=True
    )
    db_session.add(guest)
    
    await db_session.commit()
    return {"prop_id": prop.id, "guest_id": guest.id, "owner_id": owner.id}

@pytest.mark.asyncio
async def test_record_payment_idempotency(db_session: AsyncSession, setup_payment_integration):
    deps = setup_payment_integration
    
    payment_repo = PaymentRepository(db_session)
    guest_repo = GuestRepository(db_session)
    service = PaymentService(payment_repo, guest_repo)
    
    idemp_key = uuid.uuid4()
    
    # 1. Trigger First Call mapping standard execution
    payment_1 = await service.record_payment(
        property_id=deps["prop_id"],
        guest_id=deps["guest_id"],
        amount=5000.00,
        method=PaymentMethod.UPI,
        for_month=date(2026, 7, 1),
        idempotency_key=idemp_key,
        recorded_by=deps["owner_id"]
    )
    await db_session.commit()
    assert payment_1 is not None
    assert payment_1.id is not None
    
    # 2. Trigger Second Call simulating poor-connectivity retry from mobile app
    payment_2 = await service.record_payment(
        property_id=deps["prop_id"],
        guest_id=deps["guest_id"],
        amount=5000.00,
        method=PaymentMethod.UPI,
        for_month=date(2026, 7, 1),
        idempotency_key=idemp_key,
        recorded_by=deps["owner_id"]
    )
    
    # Exactly identical object reference natively fetched
    assert payment_1.id == payment_2.id
    
    # Guarantee exactly 1 row persists safely inside the Database transaction frame
    all_payments = await payment_repo.list_by_property(deps["prop_id"])
    assert len(all_payments) == 1
