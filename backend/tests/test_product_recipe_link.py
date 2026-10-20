import uuid

import pytest
from order_helpers import secure_order
from sqlalchemy.exc import IntegrityError
from test_api import login
from test_production import ROOT, create_recipe, item, recipe_payload

from app.models import Product


def create_product(client, headers, **values):
    payload = {"name": "Pão francês", "price": "1.00", "stock_quantity": 100} | values
    response = client.post("/api/products", headers=headers, json=payload)
    return response


def create_order(client, headers, product_id):
    customer = client.post(
        "/api/customers",
        headers=headers,
        json={"name": "Cliente Fila", "phone": "35988887777"},
    )
    assert customer.status_code == 201, customer.text
    response = secure_order(
        client,
        headers=headers,
        json={
            "customer_id": customer.json()["id"],
            "items": [{"product_id": product_id, "quantity": 30}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_products_link_recipes_by_id_and_orders_expose_the_link(client):
    headers = login(client)
    recipe_id = create_recipe(client, headers, recipe_payload(item(), name="Pão"))

    response = create_product(client, headers, recipe_id=recipe_id)
    assert response.status_code == 201, response.text
    product = response.json()
    assert product["recipe_id"] == recipe_id

    # Renaming the recipe keeps the link: matching never depends on names.
    renamed = recipe_payload(item(), name="Massa de pão da casa")
    assert (
        client.put(ROOT + "/recipes/" + recipe_id, headers=headers, json=renamed)
    ).status_code == 200

    order = create_order(client, headers, product["id"])
    assert order["items"][0]["recipe_id"] == recipe_id
    assert order["items"][0]["unit_of_measure"] == "unit"
    listed = client.get("/api/orders", headers=headers).json()
    assert listed[0]["items"][0]["recipe_id"] == recipe_id

    unlinked = client.patch(
        "/api/products/" + product["id"], headers=headers, json={"recipe_id": None}
    )
    assert unlinked.status_code == 200, unlinked.text
    assert unlinked.json()["recipe_id"] is None
    untouched = client.patch(
        "/api/products/" + product["id"], headers=headers, json={"price": "2.00"}
    )
    assert untouched.json()["recipe_id"] is None


def test_products_without_recipe_are_not_linked_by_name(client):
    headers = login(client)
    create_recipe(client, headers, recipe_payload(item(), name="Pão francês"))
    product = create_product(client, headers).json()
    assert product["recipe_id"] is None
    order = create_order(client, headers, product["id"])
    assert order["items"][0]["recipe_id"] is None


@pytest.mark.parametrize("method", ["post", "patch"])
def test_recipe_must_exist_in_the_same_company(client, method):
    headers = login(client)
    other = login(client, email="empresa-b@gestoria.dev")
    foreign = create_recipe(client, other, recipe_payload(item(), name="Receita B"))
    product = create_product(client, headers, name="Produto existente").json()
    for recipe_id in [foreign, str(uuid.uuid4())]:
        if method == "post":
            response = create_product(client, headers, recipe_id=recipe_id)
        else:
            response = client.patch(
                "/api/products/" + product["id"],
                headers=headers,
                json={"recipe_id": recipe_id},
            )
        assert response.status_code == 422, response.text
        assert response.json()["detail"] == "Receita não encontrada nesta empresa."
    products = client.get("/api/products", headers=headers).json()
    assert [entry["recipe_id"] for entry in products] == [None]


def test_deleting_a_recipe_unlinks_products_and_keeps_them(client):
    headers = login(client)
    recipe_id = create_recipe(client, headers, recipe_payload(item()))
    product = create_product(client, headers, recipe_id=recipe_id).json()
    assert (
        client.delete(ROOT + "/recipes/" + recipe_id, headers=headers).status_code
        == 204
    )
    products = client.get("/api/products", headers=headers).json()
    assert [(entry["id"], entry["recipe_id"]) for entry in products] == [
        (product["id"], None)
    ]


def test_database_rejects_recipe_from_another_company(client, db):
    headers = login(client)
    other = login(client, email="empresa-b@gestoria.dev")
    foreign = create_recipe(client, other, recipe_payload(item(), name="Receita B"))
    org = uuid.UUID(
        client.get("/api/auth/me", headers=headers).json()["organization"]["id"]
    )
    db.add(
        Product(
            organization_id=org,
            name="Produto inválido",
            price=1,
            recipe_id=uuid.UUID(foreign),
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
