from fastapi.testclient import TestClient

from app.api import health


def test_liveness_does_not_depend_on_database(client: TestClient, monkeypatch) -> None:
    def unavailable_database(_db) -> None:
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(health, "check_database", unavailable_database)

    response = client.get("/api/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_confirms_database_and_current_migration(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(
        health, "current_migration_revision", lambda _db: "current-head"
    )
    monkeypatch.setattr(health, "expected_migration_revision", lambda: "current-head")

    response = client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {
            "database": {"status": "ok"},
            "migrations": {
                "status": "ok",
                "current": "current-head",
                "expected": "current-head",
            },
        },
    }


def test_readiness_rejects_outdated_migration(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(
        health, "current_migration_revision", lambda _db: "previous-head"
    )
    monkeypatch.setattr(health, "expected_migration_revision", lambda: "current-head")

    response = client.get("/api/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["checks"]["database"] == {"status": "ok"}
    assert response.json()["checks"]["migrations"] == {
        "status": "error",
        "current": "previous-head",
        "expected": "current-head",
    }


def test_readiness_hides_database_error_details(
    client: TestClient, monkeypatch
) -> None:
    def unavailable_database(_db) -> None:
        raise RuntimeError("postgresql://usuario:segredo@db/gestoria")

    monkeypatch.setattr(health, "check_database", unavailable_database)

    response = client.get("/api/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {
            "database": {"status": "error"},
            "migrations": {"status": "skipped"},
        },
    }
    assert "segredo" not in response.text
