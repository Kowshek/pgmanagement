import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

async def test_set_updated_at_trigger(test_engine):
    table_name = "test_trigger_table"
    
    async with test_engine.begin() as conn:
        await conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
        
        await conn.execute(text(f"""
            CREATE TABLE {table_name} (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """))
        
        await conn.execute(text(f"""
            CREATE TRIGGER trg_{table_name}_updated_at
            BEFORE UPDATE ON {table_name}
            FOR EACH ROW
            EXECUTE FUNCTION set_updated_at();
        """))
        
        await conn.execute(text(f"INSERT INTO {table_name} (name) VALUES ('initial')"))
        
    async with test_engine.connect() as conn:
        result = await conn.execute(text(f"SELECT updated_at FROM {table_name} WHERE id = 1"))
        initial_updated_at = result.scalar()
        
    await asyncio.sleep(0.01)
    
    async with test_engine.begin() as conn:
        await conn.execute(text(f"UPDATE {table_name} SET name = 'updated' WHERE id = 1"))
        
    async with test_engine.connect() as conn:
        result = await conn.execute(text(f"SELECT updated_at FROM {table_name} WHERE id = 1"))
        new_updated_at = result.scalar()
        
    assert new_updated_at > initial_updated_at
