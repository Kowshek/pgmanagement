import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

async def test_isolation_insert(db_session: AsyncSession):
    # Postgres rolls back DDL as well, so creating a table is safe here
    await db_session.execute(text("""
        CREATE TABLE IF NOT EXISTS isolation_test (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        )
    """))
    await db_session.execute(text("INSERT INTO isolation_test (name) VALUES ('isolated')"))
    await db_session.commit() # This commits to the savepoint, not the DB
    
    result = await db_session.execute(text("SELECT COUNT(*) FROM isolation_test"))
    assert result.scalar() == 1

async def test_isolation_assert_empty(db_session: AsyncSession):
    # This test runs after test_isolation_insert. If rollback works, the table won't exist.
    # Recreate it to prove it's empty in this new transaction context.
    await db_session.execute(text("""
        CREATE TABLE IF NOT EXISTS isolation_test (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        )
    """))
    
    result = await db_session.execute(text("SELECT COUNT(*) FROM isolation_test"))
    assert result.scalar() == 0
