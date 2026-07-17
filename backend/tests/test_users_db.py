import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User

async def test_user_email_case_insensitive_unique(db_session: AsyncSession):
    # Insert first user
    user1 = User(
        email="Test@Example.com",
        phone="1234567890",
        password_hash="hashed1",
        full_name="Test User 1"
    )
    db_session.add(user1)
    await db_session.commit()
    
    # Attempt to insert second user with different case
    user2 = User(
        email="test@example.com",
        phone="0987654321",
        password_hash="hashed2",
        full_name="Test User 2"
    )
    db_session.add(user2)
    
    with pytest.raises(IntegrityError):
        await db_session.commit()
