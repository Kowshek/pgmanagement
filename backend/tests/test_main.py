import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_debug_db_check(async_client: AsyncClient):
    response = await async_client.get("/debug/db-check")
    assert response.status_code == 200
    data = response.json()
    assert data["db_status"] == "ok"
    assert data["value"] == 1
