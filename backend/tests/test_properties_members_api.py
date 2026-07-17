import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.property import Property
from app.models.property_member import PropertyMember, PropertyRole

@pytest.mark.asyncio
async def test_member_role_management(async_client: AsyncClient, db_session: AsyncSession):
    from app.core.security import create_access_token
    
    # Setup users
    owner = User(id=uuid.uuid4(), email="owner@x.com", password_hash="h", full_name="O", is_active=True)
    manager = User(id=uuid.uuid4(), email="manager@x.com", password_hash="h", full_name="M", is_active=True)
    staff = User(id=uuid.uuid4(), email="staff@x.com", password_hash="h", full_name="S", is_active=True)
    owner_2 = User(id=uuid.uuid4(), email="owner2@x.com", password_hash="h", full_name="O2", is_active=True)
    
    for u in [owner, manager, staff, owner_2]:
        db_session.add(u)
    await db_session.flush()

    # Capture plain UUIDs now, while the objects are fresh. Steps below
    # deliberately trigger app-level 403/409 rejections, and the router's
    # exception handler calls db.rollback() on those paths -- which
    # unconditionally EXPIRES every ORM object tracked by the session
    # (independent of expire_on_commit, which only governs the commit case).
    # Reading owner.id etc. again later, after such a rollback, forces a
    # synchronous lazy-reload outside any async context and crashes with
    # sqlalchemy.exc.MissingGreenlet. Plain UUID variables sidestep this
    # entirely since they aren't tied to the ORM session lifecycle.
    owner_id, manager_id, staff_id, owner_2_id = owner.id, manager.id, staff.id, owner_2.id

    tok_o = create_access_token(owner_id)
    tok_m = create_access_token(manager_id)
    tok_s = create_access_token(staff_id)

    # Setup Property and memberships
    prop = Property(id=uuid.uuid4(), owner_id=owner_id, name="Member Prop")
    db_session.add(prop)
    await db_session.flush()
    prop_id = prop.id

    mem_o = PropertyMember(id=uuid.uuid4(), property_id=prop_id, user_id=owner_id, role=PropertyRole.OWNER)
    mem_m = PropertyMember(id=uuid.uuid4(), property_id=prop_id, user_id=manager_id, role=PropertyRole.MANAGER)
    mem_s = PropertyMember(id=uuid.uuid4(), property_id=prop_id, user_id=staff_id, role=PropertyRole.STAFF)
    
    for m in [mem_o, mem_m, mem_s]:
        db_session.add(m)
    # commit (not flush): steps below intentionally trigger app-level 403/409
    # rejections, and the router's exception handler calls db.rollback() on
    # those paths. Under join_transaction_mode="create_savepoint", rollback()
    # reverts to the CURRENT savepoint and expires every tracked object. A
    # plain flush() would leave this setup data in the same savepoint as
    # those later failed operations, so it (and e.g. owner.id) would be wiped
    # the first time a 403/409 path rolls back.
    await db_session.commit()

    # 1. Staff attempts to change role -> 403
    resp = await async_client.patch(
        f"/api/v1/properties/{prop_id}/members/{manager_id}",
        json={"role": "staff"},
        headers={"Authorization": f"Bearer {tok_s}"}
    )
    assert resp.status_code == 403

    # 2. Manager successfully changes Staff to Manager -> 200
    resp = await async_client.patch(
        f"/api/v1/properties/{prop_id}/members/{staff_id}",
        json={"role": "manager"},
        headers={"Authorization": f"Bearer {tok_m}"}
    )
    assert resp.status_code == 200

    # 3. Manager attempts to demote sole Owner to Staff -> 409
    resp = await async_client.patch(
        f"/api/v1/properties/{prop_id}/members/{owner_id}",
        json={"role": "staff"},
        headers={"Authorization": f"Bearer {tok_m}"}
    )
    assert resp.status_code == 409
    assert "last owner" in resp.json()["detail"].lower()

    # 4. Manager attempts to revoke sole Owner -> 409
    resp = await async_client.delete(
        f"/api/v1/properties/{prop_id}/members/{owner_id}",
        headers={"Authorization": f"Bearer {tok_m}"}
    )
    assert resp.status_code == 409
    assert "last owner" in resp.json()["detail"].lower()

    # 5. Add second owner
    mem_o2 = PropertyMember(id=uuid.uuid4(), property_id=prop_id, user_id=owner_2_id, role=PropertyRole.OWNER)
    db_session.add(mem_o2)
    await db_session.commit() # Commit so API sees it

    # 6. Manager successfully demotes first owner now that a second owner exists
    resp = await async_client.patch(
        f"/api/v1/properties/{prop_id}/members/{owner_id}",
        json={"role": "manager"},
        headers={"Authorization": f"Bearer {tok_m}"}
    )
    assert resp.status_code == 200
