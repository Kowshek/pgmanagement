import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

async def test_set_updated_at_trigger(db_session: AsyncSession):
    table_name = "test_trigger_table"
    
    await db_session.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
    
    await db_session.execute(text(f"""
        CREATE TABLE {table_name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))
    
    await db_session.execute(text(f"""
        CREATE TRIGGER trg_{table_name}_updated_at
        BEFORE UPDATE ON {table_name}
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    """))
    
    await db_session.execute(text(f"INSERT INTO {table_name} (name) VALUES ('initial')"))
    await db_session.commit()
    
    result = await db_session.execute(text(f"SELECT updated_at FROM {table_name} WHERE id = 1"))
    initial_updated_at = result.scalar()
    
    await asyncio.sleep(0.01)
    
    await db_session.execute(text(f"UPDATE {table_name} SET name = 'updated' WHERE id = 1"))
    await db_session.commit()
    
    result = await db_session.execute(text(f"SELECT updated_at FROM {table_name} WHERE id = 1"))
    new_updated_at = result.scalar()
    
    assert new_updated_at > initial_updated_at
