from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

from test_fiscal_integrity import (
    authorization,
    create,
    incoming,
    outgoing,
    patch,
    setup_sale,
    stock,
)
from test_order_concurrency import (
    concurrent_client as concurrent_client,  # noqa: PLC0414
)


def parallel(actions):
    barrier = Barrier(len(actions))

    def run(action):
        barrier.wait(timeout=20)
        return action()

    with ThreadPoolExecutor(max_workers=len(actions)) as workers:
        return list(workers.map(run, actions))


def test_simultaneous_fiscal_creation_has_one_active_document(concurrent_client):
    client = concurrent_client
    h, _, _, order = setup_sale(client)
    responses = parallel(
        [
            lambda n=n: client.post(
                "/api/fiscal-documents", headers=h, json=outgoing(order, str(n))
            )
            for n in range(3)
        ]
    )
    assert sorted(r.status_code for r in responses) == [201, 409, 409], [
        r.text for r in responses
    ]
    assert len(client.get("/api/fiscal-documents", headers=h).json()) == 1


def test_simultaneous_receipts_increment_stock_once(concurrent_client):
    client = concurrent_client
    h, _, product, _ = setup_sale(client)
    doc = create(client, h, incoming(client, h, product))
    assert patch(client, h, doc, authorization()).status_code == 200
    before = stock(client, h, product)
    responses = parallel(
        [
            lambda: client.post(f"/api/fiscal-documents/{doc['id']}/receive", headers=h)
            for _ in range(3)
        ]
    )
    assert all(r.status_code == 200 for r in responses), [r.text for r in responses]
    assert stock(client, h, product) == before + Decimal("3.125")
    saved = client.get(f"/api/fiscal-documents/{doc['id']}", headers=h).json()
    assert [e["action"] for e in saved["events"]].count("stock_received") == 1
