from datetime import date

import pytest
from fastapi.testclient import TestClient

from test_api import login, page_items


def test_products_are_filtered_and_paginated_in_the_database(
    client: TestClient,
) -> None:
    headers = login(client)
    for name in ("Bolo", "Café", "Biscoito"):
        response = client.post(
            "/api/products",
            headers=headers,
            json={"name": name, "price": "10.00", "stock_quantity": 5},
        )
        assert response.status_code == 201

    response = client.get(
        "/api/products",
        params={"search": "B", "page": 1, "page_size": 1, "sort": "name"},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 1
    assert payload["total"] == 2
    assert payload["has_next"] is True
    assert [item["name"] for item in payload["items"]] == ["Biscoito"]


@pytest.mark.parametrize(
    "path",
    (
        "/api/customers",
        "/api/products",
        "/api/orders",
        "/api/quotes",
        "/api/finance/entries",
        "/api/fiscal-suppliers",
        "/api/management/employees",
    ),
)
def test_main_listings_reject_page_sizes_above_one_hundred(
    client: TestClient,
    path: str,
) -> None:
    headers = login(client)
    response = client.get(path, params={"page_size": 101}, headers=headers)
    assert response.status_code == 422


def test_finance_entries_paginate_after_server_side_filters(
    client: TestClient,
) -> None:
    headers = login(client)
    category = client.post(
        "/api/finance/categories",
        headers=headers,
        json={"name": "Operacional"},
    )
    assert category.status_code == 201

    for description in ("Aluguel", "Alimentação"):
        response = client.post(
            "/api/finance/entries",
            headers=headers,
            json={
                "category_id": category.json()["id"],
                "description": description,
                "amount": "100.00",
                "entry_type": "expense",
                "status": "pending",
                "transaction_date": date(2026, 11, 1).isoformat(),
            },
        )
        assert response.status_code == 201

    response = client.get(
        "/api/finance/entries",
        params={"search": "Alu", "page": 1, "page_size": 1},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["has_next"] is False
    assert [entry["description"] for entry in page_items(response)] == ["Aluguel"]
