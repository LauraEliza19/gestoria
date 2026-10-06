from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from test_api import login
from test_order_concurrency import (
    concurrent_client as concurrent_client,  # noqa: PLC0414
)
from test_production import ROOT, create_recipe, item, overview, recipe_payload, stock


def consume(client, headers, saved, **changes):
    payload = {
        "quantity": "0.5",
        "expected_quantity": saved["quantity"],
        "unit": saved["unit"],
    } | changes
    return client.post(
        ROOT + "/stock-items/" + saved["id"] + "/consume", headers=headers, json=payload
    )


def test_consumption_recalculates_recipes_and_keeps_other_brand(client):
    headers = login(client)
    saved = stock(client, headers)
    other = stock(client, headers, name="Outra marca", quantity="0.25")
    create_recipe(client, headers, recipe_payload(item()))
    response = consume(client, headers, saved, quantity="0.75")
    assert response.status_code == 200, response.text
    assert Decimal(response.json()["quantity"]) == Decimal("1.25")
    data = overview(client, headers)
    assert data["recipes"][0]["max_batches"] == 3
    assert Decimal(data["recipes"][0]["possible_yield"]) == 90
    assert next(s for s in data["stock_items"] if s["id"] == other["id"]) == other


def test_consumption_to_zero_preserves_item_and_rejects_repeat(client):
    headers = login(client)
    saved = stock(client, headers, quantity="0.125")
    response = consume(client, headers, saved, quantity="0.125")
    assert response.status_code == 200, response.text
    assert Decimal(response.json()["quantity"]) == 0
    assert consume(client, headers, saved, quantity="0.125").status_code == 409
    data = overview(client, headers)
    assert len(data["stock_items"]) == 1
    assert Decimal(data["stock_items"][0]["quantity"]) == 0


@pytest.mark.parametrize(
    "changes",
    [
        {"quantity": "3"},
        {"expected_quantity": "3"},
        {"unit": "g"},
    ],
)
def test_consumption_conflicts_preserve_stock(client, changes):
    headers = login(client)
    saved = stock(client, headers)
    assert consume(client, headers, saved, **changes).status_code == 409
    assert overview(client, headers)["stock_items"] == [saved]


@pytest.mark.parametrize(
    "changes",
    [
        {"quantity": "0"},
        {"quantity": "-1"},
        {"quantity": "NaN"},
        {"quantity": "Infinity"},
        {"quantity": "0.0001"},
        {"quantity": "1000000001"},
        {"unit": "x"},
        {"expected_quantity": "-1"},
        {"organization_id": "anything"},
    ],
)
def test_invalid_consumption_preserves_stock(client, changes):
    headers = login(client)
    saved = stock(client, headers)
    assert consume(client, headers, saved, **changes).status_code == 422
    assert overview(client, headers)["stock_items"] == [saved]


def test_consumption_authentication_and_tenant_isolation(client):
    headers = login(client)
    saved = stock(client, headers)
    other = login(client, email="empresa-b@gestoria.dev")
    assert consume(client, other, saved).status_code == 404
    assert overview(client, headers)["stock_items"] == [saved]
    client.cookies.clear()
    assert consume(client, {}, saved).status_code == 401


def test_simultaneous_consumption_uses_displayed_balance_once(concurrent_client):
    client = concurrent_client
    headers = login(client)
    saved = stock(client, headers)
    barrier = Barrier(2)

    def run():
        barrier.wait(timeout=20)
        return consume(client, headers, saved, quantity="1.5")

    with ThreadPoolExecutor(max_workers=2) as workers:
        responses = list(workers.map(lambda _: run(), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 409], [
        r.text for r in responses
    ]
    assert Decimal(overview(client, headers)["stock_items"][0]["quantity"]) == Decimal(
        "0.5"
    )
