import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole

async def test_property_member_unique_constraint(db_session: AsyncSession):
    # Create user
    user = User(
        id=uuid.uuid4(),
        email="teammember@example.com",
        password_hash="hash",
        full_name="Team Member",
        is_active=True
    )
    db_session.add(user)
    await db_session.flush()

    # Create property
    prop = Property(
        id=uuid.uuid4(),
        owner_id=user.id,
        name="Unique Property"
    )
    db_session.add(prop)
    await db_session.flush()

    # Add member
    member1 = PropertyMember(
        id=uuid.uuid4(),
        property_id=prop.id,
        user_id=user.id,
        role=PropertyRole.OWNER
    )
    db_session.add(member1)
    await db_session.flush()

    # Attempt to add same member again
    member2 = PropertyMember(
        id=uuid.uuid4(),
        property_id=prop.id,
        user_id=user.id,
        role=PropertyRole.STAFF
    )
    db_session.add(member2)
    
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.flush()
        
    assert "unique constraint" in str(exc_info.value).lower() or "uq_property_members__property_id_user_id" in str(exc_info.value)
