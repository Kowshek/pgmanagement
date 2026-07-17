import uuid
from datetime import datetime
from pydantic import BaseModel, Field

class PropertyCreateRequest(BaseModel):
    name: str
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    timezone: str = "Asia/Kolkata"
    currency: str = Field(default="INR", max_length=3, min_length=2)

class PropertyUpdateRequest(BaseModel):
    name: str | None = None
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    timezone: str | None = None
    currency: str | None = Field(default=None, max_length=3, min_length=2)
    is_active: bool | None = None

class PropertyResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    address_line: str | None
    city: str | None
    state: str | None
    pincode: str | None
    country: str
    timezone: str
    currency: str
    is_active: bool
    created_by: uuid.UUID | None
    updated_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PropertyMemberRoleUpdateRequest(BaseModel):
    role: str = Field(..., description="Role must be owner, manager, or staff")

class PropertyMemberResponse(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    is_active: bool
    invited_at: datetime | None
    accepted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
