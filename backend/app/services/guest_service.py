import uuid
import re
from datetime import date, datetime, timezone
from typing import Any

from app.models.guest import Guest, GuestType, StayUnit, FoodType
from app.repositories.guest_repository import GuestRepository
from app.repositories.room_repository import RoomRepository
from app.services.occupancy import beds_free_of
from app.core.exceptions import RoomFullError

# Matches the frontend validator: ^[+\d][\d\s-]{6,15}$
PHONE_REGEX = re.compile(r"^[+\d][\d\s-]{6,15}$")

class GuestService:
    def __init__(self, guest_repo: GuestRepository, room_repo: RoomRepository):
        self.guest_repo = guest_repo
        self.room_repo = room_repo

    def _validate_guest_data(self, phone: str | None = None, monthly_rent: float | None = None):
        if phone is not None:
            if not PHONE_REGEX.match(phone):
                raise ValueError("phone: Invalid phone number format.")
        
        if monthly_rent is not None:
            if monthly_rent < 0:
                raise ValueError("monthly_rent: Monthly rent cannot be negative.")

    async def add_guest(
        self,
        property_id: uuid.UUID,
        room_id: uuid.UUID,
        full_name: str,
        phone: str,
        monthly_rent: float,
        joined_at: date,
        guest_type: str = GuestType.PERMANENT,
        advance_paid: float | None = None,
        has_food: bool = False,
        food_type: str | None = None,
        stay_duration: int | None = None,
        stay_unit: str | None = None,
        aadhar_number_encrypted: bytes | None = None,
        aadhar_last4: str | None = None,
        permanent_address: str | None = None,
        created_by: uuid.UUID | None = None
    ) -> Guest:
        self._validate_guest_data(phone, monthly_rent)
        
        if advance_paid is not None and advance_paid < 0:
             raise ValueError("advance_paid: Advance paid cannot be negative.")

        # Concurrency Lock: Lock the room row to ensure accurate capacity validation
        room = await self.room_repo.get_by_id_for_update(room_id)
        if not room or room.property_id != property_id:
            raise ValueError("room_id: Invalid room.")

        # Fetch current guests
        guests = await self.guest_repo.list_by_property(property_id, active=True, room_id=room_id)
        
        if beds_free_of(room, guests) <= 0:
            raise RoomFullError(f"Room {room.room_number} is full.")

        guest = await self.guest_repo.create(
            property_id=property_id,
            room_id=room_id,
            full_name=full_name,
            phone=phone,
            monthly_rent=monthly_rent,
            joined_at=joined_at,
            guest_type=GuestType(guest_type),
            advance_paid=advance_paid,
            has_food=has_food,
            food_type=FoodType(food_type) if food_type else None,
            stay_duration=stay_duration,
            stay_unit=StayUnit(stay_unit) if stay_unit else None,
            aadhar_number_encrypted=aadhar_number_encrypted,
            aadhar_last4=aadhar_last4,
            permanent_address=permanent_address,
            active=True,
            created_by=created_by,
            updated_by=created_by
        )
        return guest

    async def update_guest(
        self,
        guest_id: uuid.UUID,
        updated_by: uuid.UUID | None = None,
        **fields: Any
    ) -> Guest:
        guest = await self.guest_repo.get_by_id(guest_id)
        if not guest:
            raise ValueError("Guest not found.")
            
        if "phone" in fields or "monthly_rent" in fields:
            self._validate_guest_data(fields.get("phone"), fields.get("monthly_rent"))
            
        if "advance_paid" in fields and fields["advance_paid"] is not None and fields["advance_paid"] < 0:
            raise ValueError("advance_paid: Advance paid cannot be negative.")

        target_room_id = fields.get("room_id", guest.room_id)
        target_active = fields.get("active", guest.active)
        
        if target_active and (guest.room_id != target_room_id or not guest.active):
            room = await self.room_repo.get_by_id_for_update(target_room_id)
            if not room:
                raise ValueError("room_id: Invalid room.")
            
            guests_in_target = await self.guest_repo.list_by_property(room.property_id, active=True, room_id=target_room_id)
            guests_in_target = [g for g in guests_in_target if g.id != guest.id]
            
            if beds_free_of(room, guests_in_target) <= 0:
                raise RoomFullError(f"Target room is full.")

        if not target_active and guest.active:
             fields["moved_out_at"] = fields.get("moved_out_at", datetime.now(timezone.utc).date())

        fields["updated_by"] = updated_by
        return await self.guest_repo.update(guest_id, **fields)
        
    async def set_guest_active(self, guest_id: uuid.UUID, active: bool, updated_by: uuid.UUID | None = None) -> Guest:
        return await self.update_guest(guest_id, active=active, updated_by=updated_by)
