import uuid
import pytest
import hashlib
from datetime import datetime, timedelta, timezone
from jose import jwt

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token
)
from app.core.exceptions import InvalidTokenError
from app.core.config import settings


def test_password_hashing_and_verification():
    password = "supersecretpassword"
    hashed = hash_password(password)
    
    assert hashed != password
    # Correct password verifies
    assert verify_password(password, hashed) is True
    # Wrong password fails
    assert verify_password("wrongpassword", hashed) is False

def test_refresh_token_creation():
    raw_token, token_hash = create_refresh_token()
    
    assert isinstance(raw_token, str)
    assert len(raw_token) > 0
    
    expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    assert token_hash == expected_hash

def test_access_token_decodes_to_right_user_id():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    
    decoded_user_id = decode_access_token(token)
    assert decoded_user_id == user_id

def test_expired_token_raises_error():
    user_id = uuid.uuid4()
    
    # Manually create an expired token
    expire = datetime.now(timezone.utc) - timedelta(minutes=10)
    to_encode = {"exp": expire, "sub": str(user_id)}
    expired_token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    
    with pytest.raises(InvalidTokenError, match="expired"):
        decode_access_token(expired_token)

def test_tampered_signature_token_raises_error():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    
    # Tamper with the token string
    tampered_token = token[:-1] + ("a" if token[-1] != "a" else "b")
    
    with pytest.raises(InvalidTokenError, match="Invalid token signature"):
        decode_access_token(tampered_token)

def test_missing_sub_claim_raises_error():
    # Token without the 'sub' claim
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    to_encode = {"exp": expire}
    token_missing_sub = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    
    with pytest.raises(InvalidTokenError, match="missing 'sub' claim"):
        decode_access_token(token_missing_sub)
