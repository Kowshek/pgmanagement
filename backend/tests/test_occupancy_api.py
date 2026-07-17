import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole
from app.models.room import Room, RoomType

@pytest.fixture
async def setup_occupancy_api(db_session: AsyncSession):
    from app.core.security import create_access_token
    
    owner = User(id=uuid.uuid4(), email="owner_occupancy_api@ex.com", password_hash="h", full_name="O", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Prop Occupancy")
    db_session.add(prop)
    await db_session.flush()
    mem = PropertyMember(id=uuid.uuid4(), property_id=prop.id, user_id=owner.id, role=PropertyRole.OWNER)
    db_session.add(mem)
    
    # EXACTLY 1 CAPACITY
    room1 = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room1)
    
    await db_session.commit()
    
    token = create_access_token(owner.id)
    
    return {
        "prop_id": prop.id,
        "room_1": room1.id,
        "token": token
    }

@pytest.mark.asyncio
async def test_occupancy_and_reactivation_flows(async_client: AsyncClient, setup_occupancy_api):
    prop_id = setup_occupancy_api["prop_id"]
    room_1 = setup_occupancy_api["room_1"]
    headers = {"Authorization": f"Bearer {setup_occupancy_api['token']}"}
    
    # 1. Add Original Guest
    guest_a_resp = await async_client.post(
        f"/api/v1/properties/{prop_id}/guests",
        json={"room_id": str(room_1), "full_name": "Original Guest", "phone": "1111111111", "monthly_rent": 5000, "joined_at": "2026-01-01"},
        headers=headers
    )
    assert guest_a_resp.status_code == 201
    guest_a_id = guest_a_resp.json()["id"]
    
    # 2. Check Room Occupancy (Should be FULL)
    room_resp_full = await async_client.get(f"/api/v1/properties/{prop_id}/rooms/{room_1}", headers=headers)
    assert room_resp_full.status_code == 200
    assert room_resp_full.json()["status"] == "Full"
    assert room_resp_full.json()["occupied_beds"] == 1
    
    # 3. Move Original Guest Out
    move_out_resp = await async_client.post(f"/api/v1/properties/{prop_id}/guests/{guest_a_id}/move-out", headers=headers)
    assert move_out_resp.status_code == 200
    assert move_out_resp.json()["active"] is False
    
    # 4. Check Room Occupancy (Should be Available)
    room_resp_avail = await async_client.get(f"/api/v1/properties/{prop_id}/rooms/{room_1}", headers=headers)
    assert room_resp_avail.status_code == 200
    assert room_resp_avail.json()["status"] == "Available"
    assert room_resp_avail.json()["occupied_beds"] == 0
    
    # 5. Add New Guest to the free bed
    guest_b_resp = await async_client.post(
        f"/api/v1/properties/{prop_id}/guests",
        json={"room_id": str(room_1), "full_name": "New Guest", "phone": "2222222222", "monthly_rent": 5000, "joined_at": "2026-02-01"},
        headers=headers
    )
    assert guest_b_resp.status_code == 201
    
    # 6. Attempt to Reactivate Original Guest
    reactivate_resp = await async_client.post(f"/api/v1/properties/{prop_id}/guests/{guest_a_id}/reactivate", headers=headers)
    assert reactivate_resp.status_code == 409
    assert "Target room is full" in reactivate_resp.json()["detail"]
