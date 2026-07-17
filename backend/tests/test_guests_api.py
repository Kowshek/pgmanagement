import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole
from app.models.room import Room, RoomType

@pytest.fixture
async def setup_guests_api(db_session: AsyncSession):
    from app.core.security import create_access_token
    
    owner = User(id=uuid.uuid4(), email="owner_guest_api@ex.com", password_hash="h", full_name="O", is_active=True)
    db_session.add(owner)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)
    prop = Property(id=uuid.uuid4(), owner_id=owner.id, name="Prop G")
    db_session.add(prop)
    await db_session.flush()
    mem = PropertyMember(id=uuid.uuid4(), property_id=prop.id, user_id=owner.id, role=PropertyRole.OWNER)
    db_session.add(mem)
    
    room1 = Room(id=uuid.uuid4(), property_id=prop.id, room_number="101", room_type=RoomType.DOUBLE, capacity=2)
    room2 = Room(id=uuid.uuid4(), property_id=prop.id, room_number="102", room_type=RoomType.SINGLE, capacity=1)
    db_session.add(room1)
    db_session.add(room2)
    
    await db_session.commit()
    
    token = create_access_token(owner.id)
    
    return {
        "prop_id": prop.id,
        "room_1": room1.id,
        "room_2": room2.id,
        "token": token
    }

@pytest.mark.asyncio
async def test_guests_crud_and_aadhar_security(async_client: AsyncClient, setup_guests_api):
    prop_id = setup_guests_api["prop_id"]
    room_1 = setup_guests_api["room_1"]
    headers = {"Authorization": f"Bearer {setup_guests_api['token']}"}
    
    # 1. POST
    create_resp = await async_client.post(
        f"/api/v1/properties/{prop_id}/guests",
        json={
            "room_id": str(room_1),
            "full_name": "Test Guest",
            "phone": "9876543210",
            "monthly_rent": 5000,
            "joined_at": "2026-01-01",
            "aadhar_number": "123456789012"
        },
        headers=headers
    )
    assert create_resp.status_code == 201
    guest_data = create_resp.json()
    guest_id = guest_data["id"]
    
    # Explicitly verify the strict isolation of aadhar variables out of JSON schema
    assert guest_data["aadhar_last4"] == "9012"
    assert "aadhar_number_encrypted" not in guest_data
    assert "aadhar_number" not in guest_data
    
    # 2. GET (Single)
    get_resp = await async_client.get(f"/api/v1/properties/{prop_id}/guests/{guest_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["aadhar_last4"] == "9012"
    assert "aadhar_number_encrypted" not in get_resp.json()
    assert "aadhar_number" not in get_resp.json()
    
    # 3. PATCH
    patch_resp = await async_client.patch(
        f"/api/v1/properties/{prop_id}/guests/{guest_id}",
        json={"aadhar_number": "987654321098"},
        headers=headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["aadhar_last4"] == "1098"
    assert "aadhar_number_encrypted" not in patch_resp.json()
    assert "aadhar_number" not in patch_resp.json()

@pytest.mark.asyncio
async def test_guests_list_filtering(async_client: AsyncClient, setup_guests_api):
    prop_id = setup_guests_api["prop_id"]
    room_1 = setup_guests_api["room_1"]
    room_2 = setup_guests_api["room_2"]
    headers = {"Authorization": f"Bearer {setup_guests_api['token']}"}
    
    # Seed Guests
    await async_client.post(
        f"/api/v1/properties/{prop_id}/guests",
        json={"room_id": str(room_1), "full_name": "Alice", "phone": "1111111111", "monthly_rent": 5000, "joined_at": "2026-01-01"},
        headers=headers
    )
    guest_b_resp = await async_client.post(
        f"/api/v1/properties/{prop_id}/guests",
        json={"room_id": str(room_2), "full_name": "Bob", "phone": "2222222222", "monthly_rent": 6000, "joined_at": "2026-02-01"},
        headers=headers
    )
    guest_b_id = guest_b_resp.json()["id"]
    
    # Patch Bob inactive
    await async_client.patch(
        f"/api/v1/properties/{prop_id}/guests/{guest_b_id}",
        json={"active": False, "moved_out_at": "2026-03-01"},
        headers=headers
    )
    
    # 1. Filter: active=True
    resp1 = await async_client.get(f"/api/v1/properties/{prop_id}/guests?active=True", headers=headers)
    assert resp1.status_code == 200
    assert len(resp1.json()) == 1
    assert resp1.json()[0]["full_name"] == "Alice"
    
    # 2. Filter: room_id
    resp2 = await async_client.get(f"/api/v1/properties/{prop_id}/guests?room_id={room_2}", headers=headers)
    assert len(resp2.json()) == 1
    assert resp2.json()[0]["full_name"] == "Bob"
    
    # 3. Filter: search (name/phone combined lookup)
    resp3 = await async_client.get(f"/api/v1/properties/{prop_id}/guests?search=2222", headers=headers)
    assert len(resp3.json()) == 1
    assert resp3.json()[0]["full_name"] == "Bob"
