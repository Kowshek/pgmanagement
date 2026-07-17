from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

async def test_refresh_token_indexes_exist(db_session: AsyncSession):
    # Query Postgres pg_indexes view to verify the indexes exist in the actual database
    result = await db_session.execute(
        text("SELECT indexname FROM pg_indexes WHERE tablename = 'refresh_tokens'")
    )
    indexes = [row[0] for row in result.fetchall()]
    
    assert 'ix_refresh_tokens__expires_at' in indexes
    assert 'ix_refresh_tokens__user_id__revoked_at' in indexes
