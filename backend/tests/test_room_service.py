import pytest
import uuid
from unittest.mock import AsyncMock

from app.models.room import Room, RoomType
from app.services.room_service import RoomService
from app.core.exceptions import DuplicateRoomNumberError

@pytest.mark.asyncio
async def test_create_room_duplicate_number_rejection():
    # Setup mocked repository
    mock_repo = AsyncMock()
    service = RoomService(room_repo=mock_repo)
    
    prop_id = uuid.uuid4()
    
    # 1. Simulate existing room lookup collision
    mock_repo.get_by_property_and_number.return_value = Room(id=uuid.uuid4(), room_number="101")
    
    with pytest.raises(DuplicateRoomNumberError):
        await service.create_room(
            property_id=prop_id,
            room_number="101",
            room_type=RoomType.DOUBLE,
            custom_type_label=None,
            capacity=2,
            is_ac=True,
            advance_details=None,
            created_by=uuid.uuid4()
        )
    
    mock_repo.get_by_property_and_number.assert_called_once_with(prop_id, "101")
    mock_repo.create.assert_not_called()
    
    # 2. Simulate pristine room creation validation bypass
    mock_repo.reset_mock()
    mock_repo.get_by_property_and_number.return_value = None
    mock_repo.create.return_value = Room(id=uuid.uuid4(), room_number="102")
    
    created_room = await service.create_room(
        property_id=prop_id,
        room_number="102",
        room_type=RoomType.SINGLE,
        custom_type_label=None,
        capacity=1,
        is_ac=False,
        advance_details=None,
        created_by=uuid.uuid4()
    )
    
    assert created_room.room_number == "102"
    mock_repo.get_by_property_and_number.assert_called_once_with(prop_id, "102")
    mock_repo.create.assert_called_once()

# Note: The `delete_room` integration tests checking the SQL SELECT EXISTS on `guests` 
# are intentionally deferred. The genuine ordering constraint requires the `guests` table 
# schema to exist in PostgreSQL first (scheduled for milestone 3.5), otherwise it triggers 
# a "relation does not exist" ProgrammingError on the raw DB query.
