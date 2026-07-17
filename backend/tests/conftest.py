import os
# MUST SET THIS BEFORE IMPORTING APP so settings initialize properly
os.environ["REDIS_URL"] = "redis://localhost:6380/0"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5433/pgmanager_test"

import asyncio
import subprocess
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool
from alembic import command
from alembic.config import Config

from app.main import app
from app.api.v1.deps import get_db

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_db_server():
    compose_file = os.path.join(os.path.dirname(__file__), "..", "docker", "docker-compose.test.yml")
    subprocess.run(["docker", "compose", "-f", compose_file, "up", "-d", "--wait"], check=True)
    
    db_url = "postgresql+asyncpg://postgres:postgres@localhost:5433/pgmanager_test"
    yield db_url
    
    subprocess.run(["docker", "compose", "-f", compose_file, "down", "-v"], check=True)

@pytest.fixture(scope="session")
def apply_migrations(test_db_server):
    from app.core.config import settings
    original_url = settings.database_url
    settings.database_url = test_db_server
    
    config = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    config.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    
    command.upgrade(config, "head")
    yield
    settings.database_url = original_url

@pytest.fixture(scope="session")
async def test_engine(apply_migrations, test_db_server):
    # NullPool: every checkout opens a brand-new physical connection and closes
    # it on release. A pooled engine reuses a small set of physical connections
    # across the whole test session, so if any single test leaves a connection
    # mid-operation (e.g. a crash, or the intentional concurrent-write test),
    # a later, unrelated test can be handed that same poisoned connection and
    # fail at BEGIN with "another operation is in progress". NullPool trades
    # a bit of speed for guaranteed per-test isolation.
    engine = create_async_engine(test_db_server, poolclass=NullPool, echo=False)
    yield engine
    await engine.dispose()

@pytest.fixture(autouse=True)
async def _reset_rate_limiter():
    # The slowapi Limiter (app/core/rate_limit.py) is a module-level singleton
    # backed by Redis, keyed on client IP. Every test's AsyncClient uses the
    # same fake IP (127.0.0.1:12345, set below), so login/register attempts
    # accumulate across the WHOLE pytest session instead of resetting per
    # test. Without this, later tests get spuriously 429'd on their first
    # login attempt just because earlier, unrelated tests already used up
    # that IP's quota. Flush the test Redis DB before every test.
    import redis.asyncio as aioredis
    client = aioredis.from_url("redis://localhost:6380/0")
    await client.flushdb()
    await client.aclose()
    yield

@pytest.fixture
async def db_session(test_engine) -> AsyncSession:
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(
            bind=conn, 
            expire_on_commit=False, 
            join_transaction_mode="create_savepoint"
        )
        yield session
        await session.close()
        await conn.rollback()

@pytest.fixture
def override_get_db_fixture(db_session):
    # FastAPI resolves sibling `Depends(get_db)` calls (e.g. one directly on the
    # route, another inside require_property_member) without guaranteeing they
    # run strictly sequentially. In production each call gets its own pooled
    # connection, so that's harmless. In tests every call shares ONE AsyncSession
    # bound to ONE connection so the whole test can be rolled back atomically,
    # and asyncpg raises "another operation is in progress" if two coroutines
    # touch that single connection concurrently. Serialize access with a lock
    # scoped to this test instead of giving every request its own connection.
    lock = asyncio.Lock()

    async def _override():
        async with lock:
            yield db_session
    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
async def async_client(override_get_db_fixture):
    # Pass client IP so slowapi gets a consistent fake IP
    async with AsyncClient(transport=ASGITransport(app=app, client=("127.0.0.1", 12345)), base_url="http://test") as client:
        yield client
