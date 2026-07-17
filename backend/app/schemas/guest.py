import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.guest import GuestType, StayUnit, FoodType

class GuestCreateRequest(BaseModel):
    room_id: uuid.UUID
    full_name: str
    phone: str
    monthly_rent: float = Field(..., ge=0)
    joined_at: date
    
    guest_type: GuestType = GuestType.PERMANENT
    advance_paid: float | None = Field(None, ge=0)
    has_food: bool = False
    food_type: FoodType | None = None
    stay_duration: int | None = None
    stay_unit: StayUnit | None = None
    
    aadhar_number: str | None = None
    permanent_address: str | None = None

class GuestUpdateRequest(BaseModel):
    room_id: uuid.UUID | None = None
    full_name: str | None = None
    phone: str | None = None
    monthly_rent: float | None = Field(None, ge=0)
    
    guest_type: GuestType | None = None
    advance_paid: float | None = Field(None, ge=0)
    has_food: bool | None = None
    food_type: FoodType | None = None
    stay_duration: int | None = None
    stay_unit: StayUnit | None = None
    
    aadhar_number: str | None = None
    permanent_address: str | None = None
    active: bool | None = None
    moved_out_at: date | None = None

class GuestResponse(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    room_id: uuid.UUID
    full_name: str
    phone: str
    
    aadhar_last4: str | None
    permanent_address: str | None
    
    guest_type: GuestType
    stay_duration: int | None
    stay_unit: StayUnit | None
    monthly_rent: float
    advance_paid: float | None
    has_food: bool
    food_type: FoodType | None
    
    active: bool
    joined_at: date
    moved_out_at: date | None
    
    created_by: uuid.UUID | None
    updated_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
