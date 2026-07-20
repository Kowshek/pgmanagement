import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.room import RoomCreateRequest, RoomUpdateRequest, RoomResponse
from app.services.room_service import RoomService
from app.services.occupancy import occupancy_of
from app.repositories.room_repository import RoomRepository
from app.repositories.guest_repository import GuestRepository
from app.api.v1.deps import (
    get_room_service, 
    get_room_repo, 
    get_guest_repo,
    get_db, 
    require_role,
    require_property_member
)
from app.models.property_member import PropertyMember
from app.models.room import Room
from app.models.guest import Guest
from app.core.exceptions import DuplicateRoomNumberError, RoomInUseError

router = APIRouter()

def serialize_room(room: Room, guests: list[Guest]) -> dict:
    data = {c.name: getattr(room, c.name) for c in room.__table__.columns}
    
    room_guests = [g for g in guests if g.room_id == room.id]
    occupied_beds = occupancy_of(room_guests)
    
    data["occupied_beds"] = occupied_beds
    data["status"] = "Full" if occupied_beds >= room.capacity else "Available"
    return data

@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    property_id: uuid.UUID,
    request: RoomCreateRequest,
    member: PropertyMember = Depends(require_role("staff")),
    room_service: RoomService = Depends(get_room_service),
    guest_repo: GuestRepository = Depends(get_guest_repo),
    db: AsyncSession = Depends(get_db)
):
    try:
        room = await room_service.create_room(
            property_id=property_id,
            room_number=request.room_number,
            room_type=request.room_type,
            custom_type_label=request.custom_type_label,
            capacity=request.capacity,
            is_ac=request.is_ac,
            advance_details=request.advance_details,
            created_by=member.user_id
        )
        await db.commit()
        return serialize_room(room, [])
    except DuplicateRoomNumberError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception:
        await db.rollback()
        raise

@router.get("", response_model=List[RoomResponse])
async def get_rooms(
    property_id: uuid.UUID,
    member: PropertyMember = Depends(require_property_member),
    room_repo: RoomRepository = Depends(get_room_repo),
    guest_repo: GuestRepository = Depends(get_guest_repo)
):
    rooms = await room_repo.list_by_property(property_id)
    guests = await guest_repo.list_by_property(property_id, active=True)
    return [serialize_room(r, guests) for r in rooms]

@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
    property_id: uuid.UUID,
    room_id: uuid.UUID,
    member: PropertyMember = Depends(require_property_member),
    room_repo: RoomRepository = Depends(get_room_repo),
    guest_repo: GuestRepository = Depends(get_guest_repo)
):
    room = await room_repo.get_by_id(room_id)
    if not room or room.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        
    guests = await guest_repo.list_by_property(property_id, active=True, room_id=room_id)
    return serialize_room(room, guests)

@router.patch("/{room_id}", response_model=RoomResponse)
async def update_room(
    property_id: uuid.UUID,
    room_id: uuid.UUID,
    request: RoomUpdateRequest,
    member: PropertyMember = Depends(require_role("staff")),
    room_service: RoomService = Depends(get_room_service),
    room_repo: RoomRepository = Depends(get_room_repo),
    guest_repo: GuestRepository = Depends(get_guest_repo),
    db: AsyncSession = Depends(get_db)
):
    room = await room_repo.get_by_id(room_id)
    if not room or room.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        
    update_data = request.model_dump(exclude_unset=True)
    if not update_data:
        guests = await guest_repo.list_by_property(property_id, active=True, room_id=room_id)
        return serialize_room(room, guests)
        
    update_data["updated_by"] = member.user_id

    try:
        updated_room = await room_service.update_room(room_id, **update_data)
        if not updated_room:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
            
        await db.commit()
        guests = await guest_repo.list_by_property(property_id, active=True, room_id=room_id)
        return serialize_room(updated_room, guests)
    except DuplicateRoomNumberError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await db.rollback()
        raise

@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    property_id: uuid.UUID,
    room_id: uuid.UUID,
    member: PropertyMember = Depends(require_role("staff")),
    room_service: RoomService = Depends(get_room_service),
    room_repo: RoomRepository = Depends(get_room_repo),
    db: AsyncSession = Depends(get_db)
):
    room = await room_repo.get_by_id(room_id)
    if not room or room.property_id != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        
    try:
        await room_service.delete_room(room_id)
        await db.commit()
    except RoomInUseError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception:
        await db.rollback()
        raise
