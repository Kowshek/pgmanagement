import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.guest import GuestCreateRequest, GuestUpdateRequest, GuestResponse
from app.services.guest_service import GuestService
from app.repositories.guest_repository import GuestRepository
from app.api.v1.deps import (
    get_guest_service, 
    get_guest_repo, 
    get_db, 
    require_role
)
from app.models.property_member import PropertyMember
from app.core.exceptions import RoomFullError

router = APIRouter()

@router.post("", response_model=GuestResponse, status_code=status.HTTP_201_CREATED)
async def create_guest(
    property_id: uuid.UUID,
    request: GuestCreateRequest,
    member: PropertyMember = Depends(require_role("staff")),
    guest_service: GuestService = Depends(get_guest_service),
    db: AsyncSession = Depends(get_db)
):
    try:
        aadhar_bytes = None
        aadhar_last4 = None
        if request.aadhar_number:
            aadhar_bytes = request.aadhar_number.encode("utf-8")
            aadhar_last4 = request.aadhar_number[-4:] if len(request.aadhar_number) >= 4 else request.aadhar_number
            
        guest = await guest_service.add_guest(
            property_id=property_id,
            room_id=request.room_id,
            full_name=request.full_name,
            phone=request.phone,
            monthly_rent=request.monthly_rent,
            joined_at=request.joined_at,
            guest_type=request.guest_type,
            advance_paid=request.advance_paid,
            has_food=request.has_food,
            food_type=request.food_type,
            stay_duration=request.stay_duration,
            stay_unit=request.stay_unit,
            aadhar_number_encrypted=aadhar_bytes,
            aadhar_last4=aadhar_last4,
            permanent_address=request.permanent_address,
            created_by=member.user_id
        )
        await db.commit()
        return guest
    except RoomFullError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await db.rollback()
        raise

@router.get("", response_model=List[GuestResponse])
async def list_guests(
    property_id: uuid.UUID,
    active: bool | None = Query(None),
    room_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    member: PropertyMember = Depends(require_role("staff")),
    guest_repo: GuestRepository = Depends(get_guest_repo)
):
    guests = await guest_repo.list_by_property(
        property_id=property_id,
        active=active,
        room_id=room_id,
        search=search
    )
    return guests

@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(
    property_id: uuid.UUID,
    guest_id: uuid.UUID,
    member: PropertyMember = Depends(require_role("staff")),
    guest_repo: GuestRepository = Depends(get_guest_repo)
):
    guest = await guest_repo.get_by_id(guest_id)
    if not guest or guest.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
        
    return guest

@router.patch("/{guest_id}", response_model=GuestResponse)
async def update_guest(
    property_id: uuid.UUID,
    guest_id: uuid.UUID,
    request: GuestUpdateRequest,
    member: PropertyMember = Depends(require_role("staff")),
    guest_service: GuestService = Depends(get_guest_service),
    guest_repo: GuestRepository = Depends(get_guest_repo),
    db: AsyncSession = Depends(get_db)
):
    guest = await guest_repo.get_by_id(guest_id)
    if not guest or guest.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
        
    update_data = request.model_dump(exclude_unset=True)
    if not update_data:
        return guest
        
    if "aadhar_number" in update_data:
        aadhar_number = update_data.pop("aadhar_number")
        if aadhar_number is None:
            update_data["aadhar_number_encrypted"] = None
            update_data["aadhar_last4"] = None
        else:
            update_data["aadhar_number_encrypted"] = aadhar_number.encode("utf-8")
            update_data["aadhar_last4"] = aadhar_number[-4:] if len(aadhar_number) >= 4 else aadhar_number

    try:
        updated_guest = await guest_service.update_guest(
            guest_id=guest_id,
            updated_by=member.user_id,
            **update_data
        )
        await db.commit()
        return updated_guest
    except RoomFullError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await db.rollback()
        raise

@router.post("/{guest_id}/move-out", response_model=GuestResponse)
async def move_out_guest(
    property_id: uuid.UUID,
    guest_id: uuid.UUID,
    member: PropertyMember = Depends(require_role("staff")),
    guest_service: GuestService = Depends(get_guest_service),
    guest_repo: GuestRepository = Depends(get_guest_repo),
    db: AsyncSession = Depends(get_db)
):
    guest = await guest_repo.get_by_id(guest_id)
    if not guest or guest.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
        
    try:
        updated = await guest_service.set_guest_active(guest_id, active=False, updated_by=member.user_id)
        await db.commit()
        return updated
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{guest_id}/reactivate", response_model=GuestResponse)
async def reactivate_guest(
    property_id: uuid.UUID,
    guest_id: uuid.UUID,
    member: PropertyMember = Depends(require_role("staff")),
    guest_service: GuestService = Depends(get_guest_service),
    guest_repo: GuestRepository = Depends(get_guest_repo),
    db: AsyncSession = Depends(get_db)
):
    guest = await guest_repo.get_by_id(guest_id)
    if not guest or guest.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
        
    try:
        updated = await guest_service.set_guest_active(guest_id, active=True, updated_by=member.user_id)
        await db.commit()
        return updated
    except RoomFullError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
