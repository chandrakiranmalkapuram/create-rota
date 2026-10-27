from fastapi import status


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["service"] == "Create Rota"
    assert "health" in data
    assert data["health"] == "/api/v1/health"


def test_health_check_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "Create Rota"
    assert data["database"] == "healthy"
    assert "timestamp" in data
    assert "version" in data


def test_not_found_endpoint(client):
    response = client.get("/api/v1/non-existent-route")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_cors_headers(client):
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
