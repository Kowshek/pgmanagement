import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole
from app.repositories.property_repository import PropertyRepository

async def test_list_for_user_filters_correctly(db_session: AsyncSession):
    repo = PropertyRepository(db_session)
    
    # Create two users
    user_a = User(
        id=uuid.uuid4(),
        email="user_a@example.com",
        password_hash="hash",
        full_name="User A",
        is_active=True
    )
    user_b = User(
        id=uuid.uuid4(),
        email="user_b@example.com",
        password_hash="hash",
        full_name="User B",
        is_active=True
    )
    db_session.add(user_a)
    db_session.add(user_b)
    await db_session.flush()

    # Create property owned by user A
    prop = Property(
        id=uuid.uuid4(),
        owner_id=user_a.id,
        name="User A Property"
    )
    db_session.add(prop)
    await db_session.flush()

    # Create property membership for user A
    member_a = PropertyMember(
        id=uuid.uuid4(),
        property_id=prop.id,
        user_id=user_a.id,
        role=PropertyRole.OWNER,
        is_active=True
    )
    db_session.add(member_a)
    await db_session.flush()

    # Assert User A can see the property
    user_a_props = await repo.list_for_user(user_a.id)
    assert len(user_a_props) == 1
    assert user_a_props[0].id == prop.id

    # Assert User B sees empty list
    user_b_props = await repo.list_for_user(user_b.id)
    assert len(user_b_props) == 0
