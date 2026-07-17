import hashlib
from datetime import datetime, timedelta, timezone

from app.core import security
from app.core.exceptions import EmailAlreadyExistsError, InvalidCredentialsError
from app.core.config import settings
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository

class AuthService:
    def __init__(self, user_repo: UserRepository, refresh_token_repo: RefreshTokenRepository):
        self.user_repo = user_repo
        self.refresh_token_repo = refresh_token_repo

    async def register(self, email: str, password: str, full_name: str) -> User:
        existing_user = await self.user_repo.get_by_email(email)
        if existing_user is not None:
            raise EmailAlreadyExistsError("Email already exists")
        
        password_hash = security.hash_password(password)
        
        user = await self.user_repo.create(
            email=email,
            password_hash=password_hash,
            full_name=full_name,
            is_active=True,
            is_superuser=False
        )
        return user

    async def login(self, email: str, password: str) -> tuple[str, str]:
        user = await self.user_repo.get_by_email(email)
        
        invalid_creds_err = InvalidCredentialsError("Incorrect email or password")
        
        if user is None:
            raise invalid_creds_err
            
        if not security.verify_password(password, user.password_hash):
            raise invalid_creds_err

        if not user.is_active:
            raise invalid_creds_err

        access_token = security.create_access_token(user.id)
        raw_refresh_token, token_hash = security.create_refresh_token()
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
        
        await self.refresh_token_repo.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            device_info=None
        )
        
        return access_token, raw_refresh_token

    async def refresh(self, raw_refresh_token: str) -> tuple[str, str]:
        token_hash = hashlib.sha256(raw_refresh_token.encode("utf-8")).hexdigest()
        token_record = await self.refresh_token_repo.get_by_hash(token_hash)
        
        invalid_creds_err = InvalidCredentialsError("Invalid or expired refresh token")
        
        if token_record is None:
            raise invalid_creds_err
            
        if token_record.revoked_at is not None:
            raise invalid_creds_err
            
        if token_record.expires_at < datetime.now(timezone.utc):
            raise invalid_creds_err

        # Revoke the old token
        await self.refresh_token_repo.revoke(token_hash)
        
        # Issue new tokens
        access_token = security.create_access_token(token_record.user_id)
        new_raw_refresh_token, new_token_hash = security.create_refresh_token()
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
        
        await self.refresh_token_repo.create(
            user_id=token_record.user_id,
            token_hash=new_token_hash,
            expires_at=expires_at,
            device_info=None
        )
        
        return access_token, new_raw_refresh_token

    async def logout(self, raw_refresh_token: str) -> None:
        token_hash = hashlib.sha256(raw_refresh_token.encode("utf-8")).hexdigest()
        await self.refresh_token_repo.revoke(token_hash)
