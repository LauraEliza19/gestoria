from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from test_api import login
from test_order_concurrency import (
    concurrent_client as concurrent_client,  # noqa: PLC0414
)

from app.config import settings


def parallel(actions):
    barrier = Barrier(len(actions))

    def run(action):
        barrier.wait(timeout=20)
        return action()

    with ThreadPoolExecutor(max_workers=len(actions)) as pool:
        return list(pool.map(run, actions))


def test_concurrent_refresh_has_exactly_one_winner(concurrent_client):
    headers = login(concurrent_client)
    responses = parallel(
        [
            lambda: concurrent_client.post("/api/auth/refresh", headers=headers),
            lambda: concurrent_client.post("/api/auth/refresh", headers=headers),
        ]
    )
    assert sorted(r.status_code for r in responses) == [200, 401]
    assert concurrent_client.get("/api/auth/me", headers=headers).status_code == 401


def test_rate_limit_shared_across_database_connections(concurrent_client, monkeypatch):
    monkeypatch.setattr(settings, "login_ip_limit", 2)
    responses = parallel(
        [
            lambda: concurrent_client.post(
                "/api/auth/login", headers={"X-CSRF-Protection": "1"}, json={}
            )
            for _ in range(5)
        ]
    )
    assert sorted(r.status_code for r in responses) == [422, 422, 429, 429, 429]
