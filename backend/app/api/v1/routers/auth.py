from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.auth import (
    RegisterRequest, UserResponse, LoginRequest, TokenResponse,
    RefreshRequest, LogoutRequest
)
from app.services.auth_service import AuthService
from app.core.exceptions import EmailAlreadyExistsError, InvalidCredentialsError
from app.api.v1.deps import get_auth_service, get_db, get_current_user
from app.models.user import User
from app.core.rate_limit import limiter

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    payload: RegisterRequest, 
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        user = await auth_service.register(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name
        )
        await db.commit()
        return user
    except EmailAlreadyExistsError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    except Exception:
        await db.rollback()
        raise

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: LoginRequest, 
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        access_token, refresh_token = await auth_service.login(
            email=payload.email,
            password=payload.password
        )
        await db.commit()
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
    except InvalidCredentialsError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    except Exception:
        await db.rollback()
        raise

@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        access_token, refresh_token = await auth_service.refresh(payload.refresh_token)
        await db.commit()
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
    except InvalidCredentialsError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    except Exception:
        await db.rollback()
        raise

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: LogoutRequest,
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        await auth_service.logout(payload.refresh_token)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
