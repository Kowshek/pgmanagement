import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository

async def test_user_repository_case_insensitive_email(db_session: AsyncSession):
    repo = UserRepository(db_session)
    
    # Create user with a mixed-case email via repository
    created_user = await repo.create(
        email="Case@Test.com",
        phone="555-0000",
        password_hash="fakehash",
        full_name="Case Test User"
    )
    
    # Ensure flush assigned the ID
    assert created_user.id is not None
    assert created_user.email == "Case@Test.com"
    
    # Fetch using purely lowercase email
    fetched_user = await repo.get_by_email("case@test.com")
    
    # Assert it returns the exact same row/object
    assert fetched_user is not None
    assert fetched_user.id == created_user.id
    assert fetched_user.full_name == "Case Test User"
