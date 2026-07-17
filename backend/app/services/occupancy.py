from app.models.room import Room
from app.models.guest import Guest

def active_occupants(guests: list[Guest]) -> list[Guest]:
    """Returns only the guests that are currently active."""
    return [g for g in guests if g.active]

def occupancy_of(guests: list[Guest]) -> int:
    """Calculates the current occupancy based on the number of active guests."""
    return len(active_occupants(guests))

def beds_free_of(room: Room, guests: list[Guest]) -> int:
    """Calculates the number of free beds in a room."""
    return max(0, room.capacity - occupancy_of(guests))
