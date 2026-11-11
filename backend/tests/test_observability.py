import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.observability import JsonFormatter, RequestLoggingMiddleware


def test_request_log_has_correlation_status_and_duration(caplog) -> None:
    application = FastAPI()
    application.add_middleware(RequestLoggingMiddleware)

    @application.get("/example")
    def example() -> dict[str, bool]:
        return {"ok": True}

    with (
        caplog.at_level(logging.INFO, logger="gestoria.request"),
        TestClient(application) as client,
    ):
        response = client.get("/example?token=secret-value")

    assert response.status_code == 200

    request_id = response.headers["X-Request-ID"]
    assert len(request_id) == 32
    int(request_id, 16)

    record = next(
        item
        for item in caplog.records
        if item.name == "gestoria.request" and item.getMessage() == "request_completed"
    )
    payload = json.loads(JsonFormatter().format(record))

    assert payload["event"] == "request_completed"
    assert payload["request_id"] == request_id
    assert payload["method"] == "GET"
    assert payload["path"] == "/example"
    assert payload["status_code"] == 200
    assert payload["duration_ms"] >= 0
    assert "secret-value" not in json.dumps(payload)


def test_successful_health_request_is_debug_noise_only(caplog) -> None:
    application = FastAPI()
    application.add_middleware(RequestLoggingMiddleware)

    @application.get("/api/health/live")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    with (
        caplog.at_level(logging.DEBUG, logger="gestoria.request"),
        TestClient(application) as client,
    ):
        response = client.get("/api/health/live")

    assert response.status_code == 200

    record = next(
        item
        for item in caplog.records
        if item.name == "gestoria.request" and item.getMessage() == "request_completed"
    )
    assert record.levelno == logging.DEBUG
