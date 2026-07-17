import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from app.models.user import User
from app.models.property import Property

async def test_user_deletion_restricted_when_owns_property(db_session: AsyncSession):
    # Create user
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="property_owner@example.com",
        password_hash="hash",
        full_name="Property Owner",
        is_active=True
    )
    db_session.add(user)
    await db_session.flush()

    # Create property
    prop = Property(
        id=uuid.uuid4(),
        owner_id=user.id,
        name="Test Property"
    )
    db_session.add(prop)
    await db_session.flush()

    # Attempt to delete the user via raw SQL
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.execute(
            text("DELETE FROM users WHERE id = :user_id"),
            {"user_id": user_id}
        )
    
    # Assert it was a foreign key violation
    assert "violates foreign key constraint" in str(exc_info.value).lower()
