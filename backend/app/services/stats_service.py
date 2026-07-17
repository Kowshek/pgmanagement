import uuid
from datetime import date
from typing import List

from app.schemas.stats import DashboardStats, DueGuest
from app.repositories.guest_repository import GuestRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.rent_reconciliation import balance_for_month
from app.services.occupancy import occupancy_of

class StatsService:
    def __init__(
        self,
        guest_repo: GuestRepository,
        room_repo: RoomRepository,
        payment_repo: PaymentRepository
    ):
        self.guest_repo = guest_repo
        self.room_repo = room_repo
        self.payment_repo = payment_repo

    async def dashboard_stats(self, property_id: uuid.UUID, month: date) -> DashboardStats:
        rooms = await self.room_repo.list_by_property(property_id)
        active_guests = await self.guest_repo.list_by_property(property_id, active=True)
        # Fetch all payments to accurately compute total lifetime collection
        all_payments = await self.payment_repo.list_by_property(property_id)
        
        # 1. Occupancy Tracking
        total_rooms = len(rooms)
        total_beds = sum(r.capacity for r in rooms)
        occupied_beds = occupancy_of(active_guests)
        
        occupancy_rate = 0 if total_beds == 0 else round((occupied_beds / total_beds) * 100)
        
        # 2. Financial Tracking
        total_collected = sum(float(p.amount) for p in all_payments)
        collected_this_month = sum(float(p.amount) for p in all_payments if p.for_month == month)
        
        pending_rent = 0.0
        due_guests: List[DueGuest] = []
        
        # Iterate over all currently active guests isolating their individual statements
        for guest in active_guests:
            guest_payments = [p for p in all_payments if p.guest_id == guest.id]
            balance = balance_for_month(guest, guest_payments, month)
            
            pending_rent += balance
            if balance > 0:
                due_guests.append(DueGuest(
                    guest_id=guest.id,
                    guest_name=guest.full_name,
                    balance=balance
                ))
                
        # UX formatting: highest owing guests rank first
        due_guests.sort(key=lambda x: x.balance, reverse=True)
        
        return DashboardStats(
            pending_rent=pending_rent,
            collected_this_month=collected_this_month,
            total_collected=total_collected,
            occupancy_rate=occupancy_rate,
            total_beds=total_beds,
            occupied_beds=occupied_beds,
            total_rooms=total_rooms,
            active_guests=len(active_guests),
            due_guests=due_guests
        )
