import uuid
import pytest
import hashlib
from unittest.mock import AsyncMock
from datetime import datetime, timedelta, timezone

from app.core import security
from app.core.exceptions import EmailAlreadyExistsError, InvalidCredentialsError
from app.services.auth_service import AuthService
from app.models.user import User
from app.models.refresh_token import RefreshToken

@pytest.fixture
def mock_user_repo():
    return AsyncMock()

@pytest.fixture
def mock_refresh_repo():
    return AsyncMock()

@pytest.fixture
def auth_service(mock_user_repo, mock_refresh_repo):
    return AuthService(user_repo=mock_user_repo, refresh_token_repo=mock_refresh_repo)

async def test_register_duplicate_raises(auth_service, mock_user_repo):
    mock_user_repo.get_by_email.return_value = User(id=uuid.uuid4(), email="test@test.com")
    
    with pytest.raises(EmailAlreadyExistsError):
        await auth_service.register("test@test.com", "password", "Test User")

async def test_login_wrong_password_raises(auth_service, mock_user_repo):
    user = User(
        id=uuid.uuid4(), 
        email="test@test.com", 
        password_hash=security.hash_password("correctpassword"),
        is_active=True
    )
    mock_user_repo.get_by_email.return_value = user
    
    with pytest.raises(InvalidCredentialsError, match="Incorrect email or password"):
        await auth_service.login("test@test.com", "wrongpassword")

async def test_login_nonexistent_email_raises(auth_service, mock_user_repo):
    mock_user_repo.get_by_email.return_value = None
    
    with pytest.raises(InvalidCredentialsError, match="Incorrect email or password"):
        await auth_service.login("nonexistent@test.com", "password")

async def test_refresh_valid_token_returns_new_pair_and_revokes(auth_service, mock_refresh_repo):
    user_id = uuid.uuid4()
    raw_token = "some-raw-token"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    
    mock_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        revoked_at=None
    )
    mock_refresh_repo.get_by_hash.return_value = mock_token
    
    access, new_refresh = await auth_service.refresh(raw_token)
    
    assert access is not None
    assert new_refresh is not None
    assert new_refresh != raw_token
    
    mock_refresh_repo.revoke.assert_called_once_with(token_hash)
    mock_refresh_repo.create.assert_called_once()

async def test_refresh_revoked_token_raises(auth_service, mock_refresh_repo):
    raw_token = "some-raw-token"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    
    mock_token = RefreshToken(
        user_id=uuid.uuid4(),
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        revoked_at=datetime.now(timezone.utc)
    )
    mock_refresh_repo.get_by_hash.return_value = mock_token
    
    with pytest.raises(InvalidCredentialsError, match="Invalid or expired refresh token"):
        await auth_service.refresh(raw_token)
