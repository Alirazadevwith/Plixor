async def test_health_returns_healthy(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"success": True, "status": "healthy"}


async def test_root_reports_running(client):
    res = await client.get("/")
    assert res.status_code == 200
    assert res.json()["success"] is True
