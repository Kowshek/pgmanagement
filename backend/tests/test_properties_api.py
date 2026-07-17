import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.property import Property

async def test_properties_isolation(async_client: AsyncClient):
    # 1. Register & Login User A
    user_a_payload = {
        "email": "owner_a@example.com",
        "password": "securepassword",
        "full_name": "Owner A"
    }
    await async_client.post("/api/v1/auth/register", json=user_a_payload)
    login_a_response = await async_client.post(
        "/api/v1/auth/login", 
        json={"email": "owner_a@example.com", "password": "securepassword"}
    )
    token_a = login_a_response.json()["access_token"]
    
    # 2. Register & Login User B
    user_b_payload = {
        "email": "owner_b@example.com",
        "password": "securepassword",
        "full_name": "Owner B"
    }
    await async_client.post("/api/v1/auth/register", json=user_b_payload)
    login_b_response = await async_client.post(
        "/api/v1/auth/login", 
        json={"email": "owner_b@example.com", "password": "securepassword"}
    )
    token_b = login_b_response.json()["access_token"]
    
    # 3. Create Property for User A
    prop_a_payload = {
        "name": "Property A",
        "city": "Mumbai"
    }
    create_a_resp = await async_client.post(
        "/api/v1/properties",
        json=prop_a_payload,
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert create_a_resp.status_code == 201
    
    # 4. Create Property for User B
    prop_b_payload = {
        "name": "Property B",
        "city": "Delhi"
    }
    create_b_resp = await async_client.post(
        "/api/v1/properties",
        json=prop_b_payload,
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert create_b_resp.status_code == 201
    
    # 5. Fetch properties for User A and assert isolation
    get_a_resp = await async_client.get(
        "/api/v1/properties",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert get_a_resp.status_code == 200
    props_a = get_a_resp.json()
    assert len(props_a) == 1
    assert props_a[0]["name"] == "Property A"
    
    # 6. Fetch properties for User B and assert isolation
    get_b_resp = await async_client.get(
        "/api/v1/properties",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert get_b_resp.status_code == 200
    props_b = get_b_resp.json()
    assert len(props_b) == 1
    assert props_b[0]["name"] == "Property B"

async def test_property_crud_and_permissions(async_client: AsyncClient, db_session: AsyncSession):
    # Setup Member User
    member_payload = {
        "email": "member_crud@example.com",
        "password": "securepassword",
        "full_name": "Member"
    }
    await async_client.post("/api/v1/auth/register", json=member_payload)
    login_m_resp = await async_client.post("/api/v1/auth/login", json={"email": "member_crud@example.com", "password": "securepassword"})
    token_m = login_m_resp.json()["access_token"]
    
    # Setup Non-Member User
    non_member_payload = {
        "email": "nonmember_crud@example.com",
        "password": "securepassword",
        "full_name": "Non Member"
    }
    await async_client.post("/api/v1/auth/register", json=non_member_payload)
    login_nm_resp = await async_client.post("/api/v1/auth/login", json={"email": "nonmember_crud@example.com", "password": "securepassword"})
    token_nm = login_nm_resp.json()["access_token"]
    
    # Member Creates Property
    create_resp = await async_client.post(
        "/api/v1/properties",
        json={"name": "CRUD Property", "city": "Bangalore"},
        headers={"Authorization": f"Bearer {token_m}"}
    )
    assert create_resp.status_code == 201
    prop_id = create_resp.json()["id"]
    
    # 1. Non-Member attempts GET (403)
    get_nm_resp = await async_client.get(
        f"/api/v1/properties/{prop_id}",
        headers={"Authorization": f"Bearer {token_nm}"}
    )
    assert get_nm_resp.status_code == 403
    
    # 2. Member attempts GET (200)
    get_m_resp = await async_client.get(
        f"/api/v1/properties/{prop_id}",
        headers={"Authorization": f"Bearer {token_m}"}
    )
    assert get_m_resp.status_code == 200
    assert get_m_resp.json()["name"] == "CRUD Property"
    
    # 3. Non-Member attempts PATCH (403)
    patch_nm_resp = await async_client.patch(
        f"/api/v1/properties/{prop_id}",
        json={"name": "Hacked Property"},
        headers={"Authorization": f"Bearer {token_nm}"}
    )
    assert patch_nm_resp.status_code == 403
    
    # 4. Member attempts PATCH (200)
    patch_m_resp = await async_client.patch(
        f"/api/v1/properties/{prop_id}",
        json={"name": "Updated Property"},
        headers={"Authorization": f"Bearer {token_m}"}
    )
    assert patch_m_resp.status_code == 200
    assert patch_m_resp.json()["name"] == "Updated Property"
    
    # 5. Non-Member attempts DELETE (403)
    del_nm_resp = await async_client.delete(
        f"/api/v1/properties/{prop_id}",
        headers={"Authorization": f"Bearer {token_nm}"}
    )
    assert del_nm_resp.status_code == 403
    
    # 6. Member attempts DELETE (204)
    del_m_resp = await async_client.delete(
        f"/api/v1/properties/{prop_id}",
        headers={"Authorization": f"Bearer {token_m}"}
    )
    assert del_m_resp.status_code == 204
    
    # 7. Member attempts GET after DELETE (404)
    get_del_resp = await async_client.get(
        f"/api/v1/properties/{prop_id}",
        headers={"Authorization": f"Bearer {token_m}"}
    )
    assert get_del_resp.status_code == 404
    
    # 8. Assert row exists directly in DB with deleted_at set (bypassing exclude soft-delete)
    stmt = select(Property).where(Property.id == prop_id)
    result = await db_session.execute(stmt)
    db_prop = result.scalar_one_or_none()
    assert db_prop is not None
    assert db_prop.deleted_at is not None
