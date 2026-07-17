import uuid
from sqlalchemy import text

from app.models.room import Room, RoomType
from app.repositories.room_repository import RoomRepository
from app.repositories.guest_repository import GuestRepository
from app.core.exceptions import DuplicateRoomNumberError, RoomInUseError

class RoomService:
    def __init__(self, room_repo: RoomRepository, guest_repo: GuestRepository = None):
        self.room_repo = room_repo
        self.guest_repo = guest_repo

    async def create_room(
        self,
        property_id: uuid.UUID,
        room_number: str,
        room_type: str | RoomType,
        custom_type_label: str | None,
        capacity: int,
        is_ac: bool,
        advance_details: float | None,
        created_by: uuid.UUID | None
    ) -> Room:
        existing_room = await self.room_repo.get_by_property_and_number(property_id, room_number)
        if existing_room:
            raise DuplicateRoomNumberError(f"Room number {room_number} already exists in this property.")

        return await self.room_repo.create(
            property_id=property_id,
            room_number=room_number,
            room_type=room_type,
            custom_type_label=custom_type_label,
            capacity=capacity,
            is_ac=is_ac,
            advance_details=advance_details,
            created_by=created_by,
            updated_by=created_by
        )

    async def delete_room(self, room_id: uuid.UUID) -> None:
        """
        Deletes a room after verifying no guests are currently occupying it.
        """
        if self.guest_repo:
            room = await self.room_repo.get_by_id(room_id)
            if not room:
                return
            guests = await self.guest_repo.list_by_property(room.property_id, room_id=room_id)
            if len(guests) > 0:
                raise RoomInUseError("Cannot delete room while it has associated guests.")
            
        await self.room_repo.soft_delete(room_id)
