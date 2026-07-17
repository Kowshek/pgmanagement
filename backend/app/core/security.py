import uuid
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import jwt, JWTError, ExpiredSignatureError

from app.core.config import settings
from app.core.exceptions import InvalidTokenError

ph = PasswordHasher()

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return ph.verify(hashed, password)
    except VerifyMismatchError:
        return False

def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode = {"exp": expire, "sub": str(user_id)}
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def create_refresh_token() -> tuple[str, str]:
    # Raw token sent to client
    raw_token = secrets.token_urlsafe(32)
    # Hash for database storage
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return raw_token, token_hash

def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise InvalidTokenError("Token missing 'sub' claim")
        return uuid.UUID(user_id_str)
    except ExpiredSignatureError as e:
        raise InvalidTokenError("Token has expired") from e
    except JWTError as e:
        raise InvalidTokenError("Invalid token signature or format") from e
    except ValueError as e:
        raise InvalidTokenError("Token 'sub' claim is not a valid UUID") from e
