"""Run on SQLite locally and on a disposable PostgreSQL schema when configured."""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from conftest import seed_test_data
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from test_api import login

from app.database import Base, get_db
from app.main import app


@pytest.fixture(params=["sqlite", "postgres"])
def concurrent_client(request, tmp_path):
    admin = schema = None
    if request.param == "postgres":
        address = os.environ.get("TEST_POSTGRES_URL")
        if not address:
            pytest.skip("TEST_POSTGRES_URL não configurada; PostgreSQL não executado")
        admin = create_engine(address)
        schema = "test_orders_" + uuid.uuid4().hex
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(
            make_url(address).update_query_dict({"options": f"-csearch_path={schema}"})
        )
    else:
        engine = create_engine(
            f"sqlite+pysqlite:///{tmp_path / 'concurrency.db'}",
            connect_args={"check_same_thread": False, "timeout": 15},
        )

        @event.listens_for(engine, "connect")
        def sqlite_settings(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("PRAGMA journal_mode=WAL")

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_test_data(db)

    def sessions():
        with Session(engine, expire_on_commit=False) as db:
            yield db

    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = sessions
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()
        if admin:
            with admin.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            admin.dispose()


def setup_order(client, stock=10):
    headers = login(client)
    customer = client.post(
        "/api/customers",
        headers=headers,
        json={"name": "Concorrência", "phone": "35955554444"},
    ).json()
    product = client.post(
        "/api/products",
        headers=headers,
        json={"name": "Produto concorrente", "price": "10.00", "stock_quantity": stock},
    ).json()
    body = {
        "customer_id": customer["id"],
        "items": [{"product_id": product["id"], "quantity": "1.000"}],
    }
    return headers, body


def test_simultaneous_confirmations_create_only_one_order(concurrent_client):
    client = concurrent_client
    headers, body = setup_order(client)
    proposal = client.post(
        "/api/orders/proposals",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json=body,
    ).json()
    barrier = Barrier(6)

    def send(_):
        barrier.wait(timeout=15)
        return client.post(
            f"/api/orders/proposals/{proposal['operation_id']}/confirm",
            headers=headers,
            json={"envelope": proposal["envelope"]},
        )

    with ThreadPoolExecutor(max_workers=6) as workers:
        results = list(workers.map(send, range(6)))
    assert sorted(r.status_code for r in results) == [200] * 5 + [201], [
        r.text for r in results
    ]
    assert len({r.json()["id"] for r in results}) == 1
    assert len(client.get("/api/orders", headers=headers).json()) == 1
    assert (
        float(client.get("/api/products", headers=headers).json()[0]["stock_quantity"])
        == 9
    )
    events = client.get("/api/orders/security/events", headers=headers).json()
    assert sum(e["event_type"] == "executed" for e in events) == 1


def test_concurrent_preparation_reuses_same_operation(concurrent_client):
    client = concurrent_client
    headers, body = setup_order(client)
    key, barrier = str(uuid.uuid4()), Barrier(4)

    def send(_):
        barrier.wait(timeout=15)
        return client.post(
            "/api/orders/proposals",
            headers={**headers, "Idempotency-Key": key},
            json=body,
        )

    with ThreadPoolExecutor(max_workers=4) as workers:
        results = list(workers.map(send, range(4)))
    assert all(r.status_code == 201 for r in results), [r.text for r in results]
    assert len({r.json()["operation_id"] for r in results}) == 1


def test_different_orders_cannot_oversell_last_item(concurrent_client):
    client = concurrent_client
    headers, body = setup_order(client, stock=1)
    proposals = [
        client.post(
            "/api/orders/proposals",
            headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
            json=body,
        ).json()
        for _ in range(2)
    ]
    barrier = Barrier(2)

    def send(proposal):
        barrier.wait(timeout=15)
        return client.post(
            f"/api/orders/proposals/{proposal['operation_id']}/confirm",
            headers=headers,
            json={"envelope": proposal["envelope"]},
        )

    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(send, proposals))
    assert sorted(r.status_code for r in results) == [201, 409], [
        r.text for r in results
    ]
    assert len(client.get("/api/orders", headers=headers).json()) == 1
    assert (
        float(client.get("/api/products", headers=headers).json()[0]["stock_quantity"])
        == 0
    )
