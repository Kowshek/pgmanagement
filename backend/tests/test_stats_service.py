import pytest
import uuid
from datetime import date
from unittest.mock import AsyncMock

from app.models.room import Room
from app.models.guest import Guest
from app.models.payment import Payment
from app.schemas.stats import DashboardStats, DueGuest
from app.services.stats_service import StatsService

@pytest.mark.asyncio
async def test_dashboard_stats_hand_calculated():
    prop_id = uuid.uuid4()
    target_month = date(2026, 7, 1)
    
    # 1. Setup Mock Repositories avoiding complex DB orchestration for pure-calculation validation
    guest_repo = AsyncMock()
    room_repo = AsyncMock()
    payment_repo = AsyncMock()
    
    # Environment Context: (Total beds = 3, Total rooms = 2)
    r1 = Room(id=uuid.uuid4(), property_id=prop_id, capacity=2)
    r2 = Room(id=uuid.uuid4(), property_id=prop_id, capacity=1)
    room_repo.list_by_property.return_value = [r1, r2]
    
    # Occupancy Context: (Occupied beds = 2, Active guests = 2)
    # active=True must be set explicitly: this is a pure in-memory mock object,
    # never flushed to a DB, so the column's default=True/server_default never
    # applies (those only fire on actual INSERT). Without it, guest.active is
    # None and occupancy_of()'s "if g.active" filter drops both guests.
    g1 = Guest(id=uuid.uuid4(), property_id=prop_id, room_id=r1.id, full_name="Alice", monthly_rent=5000, active=True)
    g2 = Guest(id=uuid.uuid4(), property_id=prop_id, room_id=r1.id, full_name="Bob", monthly_rent=6000, active=True)
    guest_repo.list_by_property.return_value = [g1, g2]
    
    # Payment Matrix:
    # Alice pays 5000 for July -> Balance = 0
    # Bob pays 2000 for July -> Balance = 4000
    # Alice pays 5000 for June -> Balance strictly out of bounds
    p1 = Payment(id=uuid.uuid4(), property_id=prop_id, guest_id=g1.id, amount=5000.0, for_month=target_month)
    p2 = Payment(id=uuid.uuid4(), property_id=prop_id, guest_id=g2.id, amount=2000.0, for_month=target_month)
    p3 = Payment(id=uuid.uuid4(), property_id=prop_id, guest_id=g1.id, amount=5000.0, for_month=date(2026, 6, 1))
    payment_repo.list_by_property.return_value = [p1, p2, p3]
    
    # 2. Execute Pure Functions
    service = StatsService(guest_repo, room_repo, payment_repo)
    stats = await service.dashboard_stats(prop_id, target_month)
    
    # 3. Exact Mathematical Verification
    assert stats.total_rooms == 2
    assert stats.total_beds == 3
    assert stats.active_guests == 2
    assert stats.occupied_beds == 2
    assert stats.occupancy_rate == 67  # Verified natively rounded (2/3 * 100)
    
    assert stats.collected_this_month == 7000.0  # (5000 + 2000) inside scope
    assert stats.total_collected == 12000.0      # (5000 + 2000 + 5000) absolute historical lifetime sum
    assert stats.pending_rent == 4000.0          # Alice(0) + Bob(4000)
    
    # Due Guest Matrix checks
    assert len(stats.due_guests) == 1
    assert stats.due_guests[0].guest_name == "Bob"
    assert stats.due_guests[0].balance == 4000.0

@pytest.mark.asyncio
async def test_dashboard_stats_zero_rooms():
    prop_id = uuid.uuid4()
    target_month = date(2026, 7, 1)
    
    guest_repo = AsyncMock()
    room_repo = AsyncMock()
    payment_repo = AsyncMock()
    
    # Simulating a completely blank/fresh property configuration
    room_repo.list_by_property.return_value = []
    guest_repo.list_by_property.return_value = []
    payment_repo.list_by_property.return_value = []
    
    service = StatsService(guest_repo, room_repo, payment_repo)
    stats = await service.dashboard_stats(prop_id, target_month)
    
    # Ensure explicit mathematically bounded safety stops DivisionByZero 
    assert stats.occupancy_rate == 0
    assert stats.total_beds == 0
    assert stats.total_rooms == 0
    assert stats.pending_rent == 0.0
