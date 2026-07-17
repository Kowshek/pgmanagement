import uuid
from typing import List
from pydantic import BaseModel

class DueGuest(BaseModel):
    guest_id: uuid.UUID
    guest_name: str
    balance: float

class DashboardStats(BaseModel):
    pending_rent: float
    collected_this_month: float
    total_collected: float
    occupancy_rate: int
    total_beds: int
    occupied_beds: int
    total_rooms: int
    active_guests: int
    due_guests: List[DueGuest]
