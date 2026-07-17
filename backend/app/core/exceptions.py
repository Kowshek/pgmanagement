class PGManagerError(Exception):
    """Base exception for all PG Manager application errors."""
    pass

class InvalidTokenError(PGManagerError):
    """Raised when an authentication token is invalid, expired, or missing required claims."""
    pass

class EmailAlreadyExistsError(PGManagerError):
    """Raised when attempting to register an email that already exists."""
    pass

class InvalidCredentialsError(PGManagerError):
    """Raised when authentication fails due to incorrect credentials or an invalid refresh token."""
    pass

class LastOwnerError(PGManagerError):
    """Raised when an operation would remove or demote the last active owner of a property."""
    pass

class DuplicateRoomNumberError(PGManagerError):
    """Raised when attempting to create a room with a number that already exists for the property."""
    pass

class RoomInUseError(PGManagerError):
    """Raised when attempting to delete a room that still has associated guests."""
    pass

class RoomFullError(PGManagerError):
    """Raised when attempting to add a guest to a room that is fully occupied."""
    pass
