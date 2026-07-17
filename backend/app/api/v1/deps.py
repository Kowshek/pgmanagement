import uuid
from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status, Path
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.repositories.user_repository import UserRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.property_repository import PropertyRepository
from app.repositories.property_member_repository import PropertyMemberRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.guest_repository import GuestRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.auth_service import AuthService
from app.services.property_service import PropertyService
from app.services.room_service import RoomService
from app.services.guest_service import GuestService
from app.services.payment_service import PaymentService
from app.services.stats_service import StatsService
from app.core.security import decode_access_token
from app.core.exceptions import InvalidTokenError
from app.models.user import User
from app.models.property_member import PropertyMember

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    user_repo = UserRepository(db)
    refresh_token_repo = RefreshTokenRepository(db)
    return AuthService(user_repo=user_repo, refresh_token_repo=refresh_token_repo)

def get_property_repo(db: AsyncSession = Depends(get_db)) -> PropertyRepository:
    return PropertyRepository(db)

def get_property_member_repo(db: AsyncSession = Depends(get_db)) -> PropertyMemberRepository:
    return PropertyMemberRepository(db)

def get_property_service(db: AsyncSession = Depends(get_db)) -> PropertyService:
    property_repo = PropertyRepository(db)
    property_member_repo = PropertyMemberRepository(db)
    return PropertyService(property_repo=property_repo, property_member_repo=property_member_repo)

def get_room_repo(db: AsyncSession = Depends(get_db)) -> RoomRepository:
    return RoomRepository(db)

def get_guest_repo(db: AsyncSession = Depends(get_db)) -> GuestRepository:
    return GuestRepository(db)

def get_room_service(
    room_repo: RoomRepository = Depends(get_room_repo),
    guest_repo: GuestRepository = Depends(get_guest_repo)
) -> RoomService:
    return RoomService(room_repo=room_repo, guest_repo=guest_repo)

def get_guest_service(
    guest_repo: GuestRepository = Depends(get_guest_repo),
    room_repo: RoomRepository = Depends(get_room_repo)
) -> GuestService:
    return GuestService(guest_repo=guest_repo, room_repo=room_repo)

def get_payment_repo(db: AsyncSession = Depends(get_db)) -> PaymentRepository:
    return PaymentRepository(db)

def get_payment_service(
    payment_repo: PaymentRepository = Depends(get_payment_repo),
    guest_repo: GuestRepository = Depends(get_guest_repo)
) -> PaymentService:
    return PaymentService(payment_repo=payment_repo, guest_repo=guest_repo)

def get_stats_service(
    guest_repo: GuestRepository = Depends(get_guest_repo),
    room_repo: RoomRepository = Depends(get_room_repo),
    payment_repo: PaymentRepository = Depends(get_payment_repo)
) -> StatsService:
    return StatsService(guest_repo=guest_repo, room_repo=room_repo, payment_repo=payment_repo)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        user_id = decode_access_token(token)
    except InvalidTokenError:
        raise credentials_exception
        
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    
    if user is None or not user.is_active:
        raise credentials_exception
        
    return user

async def require_property_member(
    property_id: uuid.UUID = Path(...),
    current_user: User = Depends(get_current_user),
    member_repo: PropertyMemberRepository = Depends(get_property_member_repo)
) -> PropertyMember:
    member = await member_repo.get_by_property_and_user(property_id, current_user.id)
    if not member or not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this property"
        )
    return member

def require_role(min_role: str):
    role_hierarchy = {
        "staff": 1,
        "manager": 2,
        "owner": 3
    }
    if min_role not in role_hierarchy:
        raise ValueError(f"Invalid min_role: {min_role}")
    
    async def role_checker(member: PropertyMember = Depends(require_property_member)) -> PropertyMember:
        member_rank = role_hierarchy.get(member.role.value, 0)
        required_rank = role_hierarchy[min_role]
        if member_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least {min_role} role"
            )
        return member
    return role_checker
