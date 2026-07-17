import pytest
import uuid
from datetime import date, datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole
from app.models.room import Room, RoomType
from app.models.guest import Guest, GuestType
from app.models.payment import Payment, PaymentMethod

@pytest.fixture
async def setup_stats_api(db_session: AsyncSession):
    from app.core.security import create_access_token
    
    owner = User(id=uuid.uuid4(), email="owner_stats_api@ex.com", password_hash="h", full_name="O", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Prop Stats")
    db_session.add(prop)
    await db_session.flush()
    mem = PropertyMember(id=uuid.uuid4(), property_id=prop.id, user_id=owner.id, role=PropertyRole.OWNER)
    db_session.add(mem)
    
    # Core Data Seed:
    # 2 Rooms (Total Capacity 3)
    r1 = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.DOUBLE, capacity=2)
    r2 = Room(id=uuid.uuid4(), property_id=prop.id, room_number="102", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(r1)
    db_session.add(r2)
    await db_session.flush()  # rooms must be INSERTed before guests FK-reference them

    # 2 Active Guests (Occupying r1)
    g1 = Guest(
        id=uuid.uuid4(), property_id=prop.id, room_id=r1.id,
        full_name="Alice", phone="111", monthly_rent=5000, joined_at=date(2026,1,1), active=True
    )
    g2 = Guest(
        id=uuid.uuid4(), property_id=prop.id, room_id=r1.id,
        full_name="Bob", phone="222", monthly_rent=6000, joined_at=date(2026,1,1), active=True
    )
    db_session.add(g1)
    db_session.add(g2)
    
    # Payment Matrix mapped aggressively across server dynamic times
    current_month_date = date.today().replace(day=1)
    prior_month_date = (current_month_date - timedelta(days=1)).replace(day=1)
    
    # Current Month 
    # Alice pays fully ($5000)
    # Bob pays partially ($2000 of $6000 -> $4000 balance tracking)
    p1 = Payment(id=uuid.uuid4(), property_id=prop.id, guest_id=g1.id, amount=5000, method=PaymentMethod.UPI, for_month=current_month_date, idempotency_key=uuid.uuid4())
    p2 = Payment(id=uuid.uuid4(), property_id=prop.id, guest_id=g2.id, amount=2000, method=PaymentMethod.CASH, for_month=current_month_date, idempotency_key=uuid.uuid4())
    
    # Prior Month
    # Both guests paid fully with zero lingering balances
    p3 = Payment(id=uuid.uuid4(), property_id=prop.id, guest_id=g1.id, amount=5000, method=PaymentMethod.UPI, for_month=prior_month_date, idempotency_key=uuid.uuid4())
    p4 = Payment(id=uuid.uuid4(), property_id=prop.id, guest_id=g2.id, amount=6000, method=PaymentMethod.UPI, for_month=prior_month_date, idempotency_key=uuid.uuid4())
    
    db_session.add(p1)
    db_session.add(p2)
    db_session.add(p3)
    db_session.add(p4)
    
    await db_session.commit()
    
    token = create_access_token(owner.id)
    
    return {
        "prop_id": prop.id,
        "token": token,
        "current_month": current_month_date,
        "prior_month": prior_month_date
    }

@pytest.mark.asyncio
async def test_stats_dashboard_api(async_client: AsyncClient, setup_stats_api):
    prop_id = setup_stats_api["prop_id"]
    headers = {"Authorization": f"Bearer {setup_stats_api['token']}"}
    
    # 1. Trigger Default Month Parameter (Automatically locks onto the Server's Current Month Truth)
    resp_curr = await async_client.get(f"/api/v1/properties/{prop_id}/stats/dashboard", headers=headers)
    assert resp_curr.status_code == 200
    data_curr = resp_curr.json()
    
    # Assert Structural Occupancy calculations map exactly correctly
    assert data_curr["total_rooms"] == 2
    assert data_curr["total_beds"] == 3
    assert data_curr["occupied_beds"] == 2
    assert data_curr["active_guests"] == 2
    assert data_curr["occupancy_rate"] == 67
    
    # Assert Financial arrays are securely bounded
    assert data_curr["total_collected"] == 18000.0 # historical lifetime (5000+2000+5000+6000)
    assert data_curr["collected_this_month"] == 7000.0 # scoped to present (5000+2000)
    assert data_curr["pending_rent"] == 4000.0
    
    # Verify Due Guests UI structures are cleanly sorted
    assert len(data_curr["due_guests"]) == 1
    assert data_curr["due_guests"][0]["guest_name"] == "Bob"
    assert data_curr["due_guests"][0]["balance"] == 4000.0
    
    # 2. Trigger Explicit Prior Month String Payload Query
    prior_str = setup_stats_api["prior_month"].strftime("%Y-%m")
    resp_prior = await async_client.get(f"/api/v1/properties/{prop_id}/stats/dashboard?month={prior_str}", headers=headers)
    assert resp_prior.status_code == 200
    data_prior = resp_prior.json()
    
    # Assert perfectly bounds exclusively the history records, yielding zero balance faults
    assert data_prior["collected_this_month"] == 11000.0 # (5000 + 6000)
    assert data_prior["pending_rent"] == 0.0
    assert len(data_prior["due_guests"]) == 0
