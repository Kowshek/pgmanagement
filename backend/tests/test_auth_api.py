import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository

async def test_register_success(async_client: AsyncClient):
    payload = {
        "email": "newuser@example.com",
        "password": "securepassword",
        "full_name": "New User"
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert "password" not in data
    assert "password_hash" not in data
    assert "id" in data

async def test_register_duplicate_returns_409(async_client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "securepassword",
        "full_name": "Duplicate User"
    }
    resp1 = await async_client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201
    
    resp2 = await async_client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409
    assert resp2.json()["detail"] == "Email already exists"

async def test_login_success_returns_tokens(async_client: AsyncClient):
    payload = {
        "email": "loginuser@example.com",
        "password": "securepassword",
        "full_name": "Login User"
    }
    await async_client.post("/api/v1/auth/register", json=payload)
    
    login_payload = {
        "email": "loginuser@example.com",
        "password": "securepassword"
    }
    response = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

async def test_login_wrong_password_returns_401(async_client: AsyncClient):
    payload = {
        "email": "wrongpass@example.com",
        "password": "securepassword",
        "full_name": "Wrong Pass User"
    }
    await async_client.post("/api/v1/auth/register", json=payload)
    
    login_payload = {
        "email": "wrongpass@example.com",
        "password": "wrongpassword"
    }
    response = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"

async def test_refresh_token_rotation_and_revocation(async_client: AsyncClient):
    payload = {
        "email": "refreshuser@example.com",
        "password": "securepassword",
        "full_name": "Refresh User"
    }
    await async_client.post("/api/v1/auth/register", json=payload)
    
    login_payload = {
        "email": "refreshuser@example.com",
        "password": "securepassword"
    }
    login_response = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == 200
    original_refresh_token = login_response.json()["refresh_token"]
    
    refresh_response = await async_client.post(
        "/api/v1/auth/refresh", 
        json={"refresh_token": original_refresh_token}
    )
    assert refresh_response.status_code == 200
    new_data = refresh_response.json()
    new_refresh_token = new_data["refresh_token"]
    assert new_refresh_token != original_refresh_token
    
    reused_response = await async_client.post(
        "/api/v1/auth/refresh", 
        json={"refresh_token": original_refresh_token}
    )
    assert reused_response.status_code == 401
    assert reused_response.json()["detail"] == "Invalid or expired refresh token"

async def test_logout_revokes_token(async_client: AsyncClient):
    payload = {
        "email": "logoutuser@example.com",
        "password": "securepassword",
        "full_name": "Logout User"
    }
    await async_client.post("/api/v1/auth/register", json=payload)
    
    login_payload = {
        "email": "logoutuser@example.com",
        "password": "securepassword"
    }
    login_response = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == 200
    refresh_token = login_response.json()["refresh_token"]
    
    logout_response = await async_client.post(
        "/api/v1/auth/logout", 
        json={"refresh_token": refresh_token}
    )
    assert logout_response.status_code == 204
    
    refresh_response = await async_client.post(
        "/api/v1/auth/refresh", 
        json={"refresh_token": refresh_token}
    )
    assert refresh_response.status_code == 401

async def test_get_me_success(async_client: AsyncClient):
    payload = {
        "email": "me_user@example.com",
        "password": "securepassword",
        "full_name": "Me User"
    }
    await async_client.post("/api/v1/auth/register", json=payload)
    
    login_response = await async_client.post(
        "/api/v1/auth/login", 
        json={"email": "me_user@example.com", "password": "securepassword"}
    )
    access_token = login_response.json()["access_token"]
    
    me_response = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_response.status_code == 200
    data = me_response.json()
    assert data["email"] == "me_user@example.com"
    assert data["full_name"] == "Me User"

async def test_get_me_missing_token_returns_401(async_client: AsyncClient):
    me_response = await async_client.get("/api/v1/auth/me")
    assert me_response.status_code == 401
    assert me_response.json()["detail"] == "Not authenticated"

async def test_get_me_garbage_token_returns_401(async_client: AsyncClient):
    me_response = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-jwt"}
    )
    assert me_response.status_code == 401
    assert me_response.json()["detail"] == "Could not validate credentials"

async def test_get_me_deactivated_user_returns_401(async_client: AsyncClient, db_session: AsyncSession):
    payload = {
        "email": "deactivated@example.com",
        "password": "securepassword",
        "full_name": "Deact User"
    }
    await async_client.post("/api/v1/auth/register", json=payload)
    
    login_response = await async_client.post(
        "/api/v1/auth/login", 
        json={"email": "deactivated@example.com", "password": "securepassword"}
    )
    access_token = login_response.json()["access_token"]
    
    # Update is_active=False directly via the repository
    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_email("deactivated@example.com")
    user.is_active = False
    await db_session.commit()
    
    me_response = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_response.status_code == 401
    assert me_response.json()["detail"] == "Could not validate credentials"

async def test_rate_limit_login(async_client: AsyncClient):
    login_payload = {
        "email": "ratelimit@example.com",
        "password": "wrongpassword"
    }
    
    # 5 rapid requests should pass the limiter but fail auth
    for _ in range(5):
        resp = await async_client.post("/api/v1/auth/login", json=login_payload)
        assert resp.status_code == 401
        
    # 6th request hits the 5/minute limit
    resp = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 429
    assert "Rate limit exceeded" in resp.json().get("error", "")

async def test_health_not_rate_limited(async_client: AsyncClient):
    # Fire 6 rapid requests at a non-limited endpoint
    for _ in range(6):
        resp = await async_client.get("/health")
        assert resp.status_code == 200
