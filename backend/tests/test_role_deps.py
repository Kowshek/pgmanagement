import pytest
import uuid
from httpx import AsyncClient
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.api.v1.deps import require_role
from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole

# Setup ephemeral dynamic router purely for dependency evaluation
test_router = APIRouter()

@test_router.get("/test/roles/{property_id}/staff")
async def test_staff(member=Depends(require_role("staff"))): return {"ok": True}

@test_router.get("/test/roles/{property_id}/manager")
async def test_manager(member=Depends(require_role("manager"))): return {"ok": True}

@test_router.get("/test/roles/{property_id}/owner")
async def test_owner(member=Depends(require_role("owner"))): return {"ok": True}

app.include_router(test_router)

@pytest.mark.asyncio
async def test_role_matrix(async_client: AsyncClient, db_session: AsyncSession):
    roles = [
        ("staff", PropertyRole.STAFF),
        ("manager", PropertyRole.MANAGER),
        ("owner", PropertyRole.OWNER)
    ]
    
    # 1. Base property framework
    owner_user = User(id=uuid.uuid4(), email="matrix_owner@ex.com", password_hash="hash", full_name="O", is_active=True)
    db_session.add(owner_user)
    await db_session.flush()  # owner must be INSERTed before rows FK-referencing it (no relationship() defined to auto-order)

    prop = Property(id=uuid.uuid4(), owner_id=owner_user.id, name="Matrix Prop")
    db_session.add(prop)
    await db_session.flush()

    for role_name, enum_val in roles:
        # Create user & specific hierarchical membership
        u = User(id=uuid.uuid4(), email=f"user_{role_name}@ex.com", password_hash="hash", full_name="U", is_active=True)
        db_session.add(u)
        await db_session.flush()
        
        mem = PropertyMember(id=uuid.uuid4(), property_id=prop.id, user_id=u.id, role=enum_val)
        db_session.add(mem)
        await db_session.flush()
        
        from app.core.security import create_access_token
        token = create_access_token(u.id)
        
        # Table matrix denoting expected valid behaviors per role depth against endpoint thresholds
        expected_matrix = {
            "staff": {"staff": 200, "manager": 403, "owner": 403},
            "manager": {"staff": 200, "manager": 200, "owner": 403},
            "owner": {"staff": 200, "manager": 200, "owner": 200}
        }
        
        for min_role in ["staff", "manager", "owner"]:
            resp = await async_client.get(
                f"/test/roles/{prop.id}/{min_role}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert resp.status_code == expected_matrix[role_name][min_role], f"Role {role_name} accessing threshold {min_role} got {resp.status_code}"

@pytest.mark.asyncio
async def test_cross_tenant_isolation(async_client: AsyncClient, db_session: AsyncSession):
    from app.core.security import create_access_token
    
    # User X
    user_x = User(id=uuid.uuid4(), email="x@ex.com", password_hash="h", full_name="X", is_active=True)
    db_session.add(user_x)
    await db_session.flush()
    token_x = create_access_token(user_x.id)
    
    # Property A (User X is member)
    prop_a = Property(id=uuid.uuid4(), owner_id=user_x.id, name="A")
    db_session.add(prop_a)
    mem_a = PropertyMember(id=uuid.uuid4(), property_id=prop_a.id, user_id=user_x.id, role=PropertyRole.OWNER)
    db_session.add(mem_a)
    
    # Property B (User X is NOT member, only Y is)
    user_y = User(id=uuid.uuid4(), email="y@ex.com", password_hash="h", full_name="Y", is_active=True)
    db_session.add(user_y)
    await db_session.flush()
    
    prop_b = Property(id=uuid.uuid4(), owner_id=user_y.id, name="B")
    db_session.add(prop_b)
    mem_b = PropertyMember(id=uuid.uuid4(), property_id=prop_b.id, user_id=user_y.id, role=PropertyRole.OWNER)
    db_session.add(mem_b)
    await db_session.flush()
    
    # Verify User X has full 200 GET over Property A
    resp_a = await async_client.get(
        f"/api/v1/properties/{prop_a.id}",
        headers={"Authorization": f"Bearer {token_x}"}
    )
    assert resp_a.status_code == 200
    
    # Verify User X bounces hard via 403 on Property B
    resp_b = await async_client.get(
        f"/api/v1/properties/{prop_b.id}",
        headers={"Authorization": f"Bearer {token_x}"}
    )
    assert resp_b.status_code == 403
