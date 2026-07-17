import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.property import (
    PropertyCreateRequest, 
    PropertyUpdateRequest, 
    PropertyResponse,
    PropertyMemberResponse,
    PropertyMemberRoleUpdateRequest
)
from app.services.property_service import PropertyService
from app.repositories.property_repository import PropertyRepository
from app.repositories.property_member_repository import PropertyMemberRepository
from app.api.v1.deps import (
    get_property_service, 
    get_property_repo,
    get_property_member_repo,
    get_db, 
    get_current_user,
    require_property_member,
    require_role
)
from app.models.user import User
from app.models.property_member import PropertyMember
from app.core.exceptions import LastOwnerError

router = APIRouter()

@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
async def create_property(
    request: PropertyCreateRequest,
    current_user: User = Depends(get_current_user),
    property_service: PropertyService = Depends(get_property_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        prop = await property_service.create_property(
            owner_id=current_user.id,
            name=request.name,
            address_line=request.address_line,
            city=request.city,
            state=request.state,
            pincode=request.pincode,
            timezone=request.timezone,
            currency=request.currency
        )
        await db.commit()
        return prop
    except Exception:
        await db.rollback()
        raise

@router.get("", response_model=list[PropertyResponse])
async def get_properties(
    current_user: User = Depends(get_current_user),
    property_repo: PropertyRepository = Depends(get_property_repo)
):
    return await property_repo.list_for_user(current_user.id)

@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: uuid.UUID,
    member: PropertyMember = Depends(require_property_member),
    property_repo: PropertyRepository = Depends(get_property_repo)
):
    prop = await property_repo.get_by_id(property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
        
    return prop

@router.patch("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: uuid.UUID,
    request: PropertyUpdateRequest,
    member: PropertyMember = Depends(require_role("manager")),
    property_repo: PropertyRepository = Depends(get_property_repo),
    db: AsyncSession = Depends(get_db)
):
    update_data = request.model_dump(exclude_unset=True)
    if not update_data:
        prop = await property_repo.get_by_id(property_id)
        if not prop:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
        return prop
        
    update_data["updated_by"] = member.user_id

    try:
        updated_prop = await property_repo.update(property_id, **update_data)
        if not updated_prop:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
            
        await db.commit()
        return updated_prop
    except Exception:
        await db.rollback()
        raise

@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: uuid.UUID,
    member: PropertyMember = Depends(require_role("owner")),
    property_repo: PropertyRepository = Depends(get_property_repo),
    db: AsyncSession = Depends(get_db)
):
    prop = await property_repo.get_by_id(property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
        
    try:
        await property_repo.soft_delete(property_id)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

@router.get("/{property_id}/members", response_model=list[PropertyMemberResponse])
async def get_property_members(
    property_id: uuid.UUID,
    member: PropertyMember = Depends(require_property_member),
    member_repo: PropertyMemberRepository = Depends(get_property_member_repo)
):
    return await member_repo.list_by_property(property_id, active_only=True)

@router.patch("/{property_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def update_property_member_role(
    property_id: uuid.UUID,
    user_id: uuid.UUID,
    request: PropertyMemberRoleUpdateRequest,
    member: PropertyMember = Depends(require_role("manager")),
    property_service: PropertyService = Depends(get_property_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        await property_service.change_member_role(property_id, user_id, request.role)
        await db.commit()
        return {"status": "success"}
    except LastOwnerError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await db.rollback()
        raise

@router.delete("/{property_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_property_member(
    property_id: uuid.UUID,
    user_id: uuid.UUID,
    member: PropertyMember = Depends(require_role("manager")),
    property_service: PropertyService = Depends(get_property_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        await property_service.revoke_member(property_id, user_id)
        await db.commit()
    except LastOwnerError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await db.rollback()
        raise
