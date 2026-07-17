import pytest
import uuid
from datetime import date
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole
from app.models.room import Room, RoomType
from app.models.guest import Guest

@pytest.fixture
async def setup_payments_api(db_session: AsyncSession):
    from app.core.security import create_access_token
    
    owner = User(id=uuid.uuid4(), email="owner_payments_api@ex.com", password_hash="h", full_name="O", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Prop P")
    db_session.add(prop)
    await db_session.flush()
    mem = PropertyMember(id=uuid.uuid4(), property_id=prop.id, user_id=owner.id, role=PropertyRole.OWNER)
    db_session.add(mem)
    
    room = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.DOUBLE, capacity=2)
    db_session.add(room)
    await db_session.flush()  # same ordering issue: room must exist before guest FK-references it

    guest1 = Guest(
        id=uuid.uuid4(), property_id=prop.id, room_id=room.id,
        full_name="Guest 1", phone="1111111111", monthly_rent=5000, joined_at=date(2026, 1, 1)
    )
    guest2 = Guest(
        id=uuid.uuid4(), property_id=prop.id, room_id=room.id,
        full_name="Guest 2", phone="2222222222", monthly_rent=6000, joined_at=date(2026, 1, 1)
    )
    db_session.add(guest1)
    db_session.add(guest2)
    
    await db_session.commit()
    
    token = create_access_token(owner.id)
    
    return {
        "prop_id": prop.id,
        "guest_1": guest1.id,
        "guest_2": guest2.id,
        "token": token
    }

@pytest.mark.asyncio
async def test_payment_create_requires_idempotency_key(async_client: AsyncClient, setup_payments_api):
    prop_id = setup_payments_api["prop_id"]
    guest_1 = setup_payments_api["guest_1"]
    headers = {"Authorization": f"Bearer {setup_payments_api['token']}"}
    
    resp = await async_client.post(
        f"/api/v1/properties/{prop_id}/payments",
        json={
            "guest_id": str(guest_1),
            "amount": 5000,
            "method": "upi",
            "for_month": "2026-07-01",
            # missing idempotency_key
        },
        headers=headers
    )
    assert resp.status_code == 422
    assert "idempotency_key" in str(resp.json())

@pytest.mark.asyncio
async def test_payments_list_filters(async_client: AsyncClient, setup_payments_api):
    prop_id = setup_payments_api["prop_id"]
    g1 = setup_payments_api["guest_1"]
    g2 = setup_payments_api["guest_2"]
    headers = {"Authorization": f"Bearer {setup_payments_api['token']}"}
    
    # 1. P1: G1, 2026-07
    await async_client.post(
        f"/api/v1/properties/{prop_id}/payments",
        json={"guest_id": str(g1), "amount": 5000, "method": "upi", "for_month": "2026-07-01", "idempotency_key": str(uuid.uuid4())},
        headers=headers
    )
    # 2. P2: G1, 2026-08
    await async_client.post(
        f"/api/v1/properties/{prop_id}/payments",
        json={"guest_id": str(g1), "amount": 5000, "method": "cash", "for_month": "2026-08-01", "idempotency_key": str(uuid.uuid4())},
        headers=headers
    )
    # 3. P3: G2, 2026-07
    await async_client.post(
        f"/api/v1/properties/{prop_id}/payments",
        json={"guest_id": str(g2), "amount": 6000, "method": "upi", "for_month": "2026-07-01", "idempotency_key": str(uuid.uuid4())},
        headers=headers
    )
    
    # Filter A: Test formatting parser correctly locks onto `month` logic 
    resp_month = await async_client.get(f"/api/v1/properties/{prop_id}/payments?month=2026-07", headers=headers)
    assert resp_month.status_code == 200
    assert len(resp_month.json()) == 2
    
    # Filter B: Test strict property guest-isolation 
    resp_guest = await async_client.get(f"/api/v1/properties/{prop_id}/payments?guest_id={g1}", headers=headers)
    assert resp_guest.status_code == 200
    assert len(resp_guest.json()) == 2

@pytest.mark.asyncio
async def test_payment_soft_delete(async_client: AsyncClient, setup_payments_api, db_session: AsyncSession):
    prop_id = setup_payments_api["prop_id"]
    g1 = setup_payments_api["guest_1"]
    headers = {"Authorization": f"Bearer {setup_payments_api['token']}"}
    
    resp = await async_client.post(
        f"/api/v1/properties/{prop_id}/payments",
        json={"guest_id": str(g1), "amount": 5000, "method": "upi", "for_month": "2026-07-01", "idempotency_key": str(uuid.uuid4())},
        headers=headers
    )
    assert resp.status_code == 201
    payment_id = resp.json()["id"]
    
    # Trigger API Delete Command
    del_resp = await async_client.delete(f"/api/v1/properties/{prop_id}/payments/{payment_id}", headers=headers)
    assert del_resp.status_code == 204
    
    # Verify standard API list successfully ghosts it
    list_resp = await async_client.get(f"/api/v1/properties/{prop_id}/payments", headers=headers)
    assert len(list_resp.json()) == 0
    
    # Use Raw SQL Bypass verifying historical data retains structure exactly as expected via Soft Deletes
    result = await db_session.execute(text(f"SELECT deleted_at FROM payments WHERE id = '{payment_id}'"))
    row = result.fetchone()
    assert row is not None
    assert row[0] is not None
