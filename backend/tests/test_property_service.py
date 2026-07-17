import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole
from app.repositories.property_repository import PropertyRepository
from app.repositories.property_member_repository import PropertyMemberRepository
from app.services.property_service import PropertyService

async def test_create_property_creates_membership_atomically(db_session: AsyncSession):
    # Setup Data
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="owner_service@example.com",
        password_hash="hash",
        full_name="Service Owner",
        is_active=True
    )
    db_session.add(user)
    await db_session.flush()

    # Setup Service
    prop_repo = PropertyRepository(db_session)
    member_repo = PropertyMemberRepository(db_session)
    service = PropertyService(property_repo=prop_repo, property_member_repo=member_repo)

    # Call create_property
    prop = await service.create_property(
        owner_id=user_id,
        name="Atomicity Test Property",
        timezone="UTC",
        currency="USD"
    )
    
    # Verify property exists and is correctly populated
    stmt = select(Property).where(Property.id == prop.id)
    result = await db_session.execute(stmt)
    db_prop = result.scalar_one_or_none()
    
    assert db_prop is not None
    assert db_prop.name == "Atomicity Test Property"
    assert db_prop.owner_id == user_id
    assert db_prop.timezone == "UTC"
    assert db_prop.currency == "USD"
    
    # Verify property_members exists and is linked
    member_stmt = select(PropertyMember).where(
        PropertyMember.property_id == prop.id,
        PropertyMember.user_id == user_id
    )
    member_result = await db_session.execute(member_stmt)
    db_member = member_result.scalar_one_or_none()
    
    assert db_member is not None
    assert db_member.role == PropertyRole.OWNER
    assert db_member.is_active is True
    assert db_member.accepted_at is not None
