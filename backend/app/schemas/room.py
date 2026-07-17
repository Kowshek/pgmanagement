import uuid
from typing import Literal
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.room import RoomType

class RoomCreateRequest(BaseModel):
    room_number: str = Field(..., max_length=20)
    room_type: RoomType
    custom_type_label: str | None = None
    capacity: int = Field(..., ge=1, le=20)
    is_ac: bool = False
    advance_details: float | None = None

class RoomUpdateRequest(BaseModel):
    room_number: str | None = Field(None, max_length=20)
    room_type: RoomType | None = None
    custom_type_label: str | None = None
    capacity: int | None = Field(None, ge=1, le=20)
    is_ac: bool | None = None
    advance_details: float | None = None
    is_active: bool | None = None

class RoomResponse(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    room_number: str
    room_type: RoomType
    custom_type_label: str | None
    capacity: int
    is_ac: bool
    advance_details: float | None
    is_active: bool
    
    occupied_beds: int
    status: Literal["Full", "Available"]
    
    created_by: uuid.UUID | None
    updated_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
