import uuid
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from test_api import login

from app.models.production import RecipeIngredient, StockItem
from app.services.production import ProductionError, convert, normalize_name

ROOT = "/api/production"


def stock(
    client,
    headers,
    name="Farinha Santa Amália",
    quantity="2",
    unit="kg",
    ingredient_name="Farinha de trigo",
    ingredient_id=None,
):
    payload = {"name": name, "quantity": quantity, "unit": unit}
    payload.update(
        {"ingredient_id": ingredient_id}
        if ingredient_id
        else {"ingredient_name": ingredient_name}
    )
    response = client.post(ROOT + "/stock-items", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def recipe_payload(*items, name="Pão"):
    return {
        "name": name,
        "yield_quantity": "30",
        "yield_unit": "unidades",
        "items": list(items),
    }


def item(name="Farinha de trigo", quantity="500", unit="g"):
    return {"ingredient_name": name, "quantity": quantity, "unit": unit}


def create_recipe(client, headers, payload):
    response = client.post(ROOT + "/recipes", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def overview(client, headers):
    response = client.get(ROOT, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize(
    "quantity,source,target,expected",
    [
        ("2", "kg", "g", "2000"),
        ("250", "g", "kg", "0.25"),
        ("3", "L", "ml", "3000"),
        ("240", "ml", "L", "0.24"),
        ("3", "un", "un", "3"),
        ("0.001", "g", "kg", "0.000001"),
    ],
)
def test_unit_conversion(quantity, source, target, expected):
    assert convert(Decimal(quantity), source, target) == Decimal(expected)


@pytest.mark.parametrize("source,target", [("g", "ml"), ("L", "kg"), ("un", "g")])
def test_incompatible_units(source, target):
    with pytest.raises(ProductionError):
        convert(Decimal(1), source, target)


def test_recipes_without_stock_and_normalized_names(client):
    headers = login(client)
    create_recipe(
        client, headers, recipe_payload(item("  AÇÚCAR  cristal ", "1", "kg"))
    )
    create_recipe(
        client,
        headers,
        recipe_payload(item("acucar   CRISTAL", "500", "g"), name="Outra receita"),
    )
    data = overview(client, headers)
    assert data["stock_items"] == []
    assert len(data["ingredients"]) == 1
    assert len(data["recipes"]) == 2
    assert all(recipe["max_batches"] == 0 for recipe in data["recipes"])
    assert all(
        Decimal(recipe["items"][0]["available_quantity"]) == 0
        for recipe in data["recipes"]
    )
    assert normalize_name(" AÇÚCAR  cristal ") == "acucar cristal"


def test_brands_sum_after_conversion_and_deleting_stock_preserves_recipe(client):
    headers = login(client)
    recipe_id = create_recipe(client, headers, recipe_payload(item()))
    ingredient_id = overview(client, headers)["ingredients"][0]["id"]
    first = stock(client, headers, quantity="1", ingredient_id=ingredient_id)
    second = stock(
        client,
        headers,
        name="Farinha outra marca",
        quantity="500",
        unit="g",
        ingredient_id=ingredient_id,
    )
    for _ in range(2):
        data = overview(client, headers)
        recipe = data["recipes"][0]
        assert recipe["max_batches"] == 3
        assert Decimal(recipe["possible_yield"]) == 90
        assert Decimal(recipe["items"][0]["available_quantity"]) == 1500
        assert len(data["stock_items"]) == 2
    assert (
        client.delete(ROOT + "/stock-items/" + first["id"], headers=headers).status_code
        == 204
    )
    assert overview(client, headers)["recipes"][0]["max_batches"] == 1
    assert (
        client.delete(
            ROOT + "/stock-items/" + second["id"], headers=headers
        ).status_code
        == 204
    )
    data = overview(client, headers)
    assert data["stock_items"] == []
    assert data["recipes"][0]["id"] == recipe_id
    assert data["recipes"][0]["max_batches"] == 0
    assert Decimal(data["recipes"][0]["items"][0]["missing_quantity"]) == 500
    assert len(data["ingredients"]) == 1
    assert client.get("/api/products", headers=headers).json() == []


def test_reassociate_stock_without_rewriting_recipes(client):
    headers = login(client)
    create_recipe(client, headers, recipe_payload(item(), name="Pão de trigo"))
    create_recipe(
        client, headers, recipe_payload(item("Farinha de arroz"), name="Pão de arroz")
    )
    data = overview(client, headers)
    ids = {ingredient["name"]: ingredient["id"] for ingredient in data["ingredients"]}
    saved = stock(client, headers, ingredient_id=ids["Farinha de trigo"])
    before = {
        recipe["id"]: recipe["items"][0]["ingredient_id"] for recipe in data["recipes"]
    }
    response = client.put(
        ROOT + "/stock-items/" + saved["id"],
        headers=headers,
        json={
            "name": saved["name"],
            "quantity": "2",
            "unit": "kg",
            "ingredient_id": ids["Farinha de arroz"],
        },
    )
    assert response.status_code == 200, response.text
    recipes = overview(client, headers)["recipes"]
    assert {
        recipe["id"]: recipe["items"][0]["ingredient_id"] for recipe in recipes
    } == before
    assert {recipe["name"]: recipe["max_batches"] for recipe in recipes} == {
        "Pão de trigo": 0,
        "Pão de arroz": 4,
    }


def test_similar_names_are_not_automatically_linked(client):
    headers = login(client)
    create_recipe(client, headers, recipe_payload(item()))
    stock(client, headers, ingredient_name="Farinha de arroz")
    stock(client, headers, name="Marca teste", ingredient_name="Farina de trigo")
    data = overview(client, headers)
    assert len(data["ingredients"]) == 3
    assert data["recipes"][0]["max_batches"] == 0


def test_limiting_ingredient_and_fractional_stock(client):
    headers = login(client)
    create_recipe(
        client,
        headers,
        recipe_payload(
            item(quantity="1", unit="kg"),
            item("Leite", "240", "ml"),
            item("Queijo", "300", "g"),
        ),
    )
    stock(client, headers)
    stock(
        client,
        headers,
        name="Leite marca A",
        quantity="3",
        unit="L",
        ingredient_name="Leite",
    )
    cheese = stock(
        client,
        headers,
        name="Queijo marca A",
        quantity="150",
        unit="g",
        ingredient_name="Queijo",
    )
    recipe = overview(client, headers)["recipes"][0]
    assert recipe["max_batches"] == 0
    assert (
        Decimal(
            next(row for row in recipe["items"] if row["ingredient_name"] == "Queijo")[
                "missing_quantity"
            ]
        )
        == 150
    )
    assert (
        client.put(
            ROOT + "/stock-items/" + cheese["id"],
            headers=headers,
            json={
                "name": cheese["name"],
                "quantity": "0.6",
                "unit": "kg",
                "ingredient_id": cheese["ingredient_id"],
            },
        ).status_code
        == 200
    )
    recipe = overview(client, headers)["recipes"][0]
    assert recipe["max_batches"] == 2
    assert Decimal(recipe["possible_yield"]) == 60


def test_invalid_recipe_rolls_back_new_ingredients_and_existing_recipe(client):
    headers = login(client)
    recipe_id = create_recipe(client, headers, recipe_payload(item()))
    invalid = recipe_payload(item("Ingrediente novo"), item(unit="L"))
    assert (
        client.put(
            ROOT + "/recipes/" + recipe_id, headers=headers, json=invalid
        ).status_code
        == 422
    )
    data = overview(client, headers)
    assert [ingredient["name"] for ingredient in data["ingredients"]] == [
        "Farinha de trigo"
    ]
    assert data["recipes"][0]["items"][0]["unit"] == "g"
    duplicate = recipe_payload(item(), item(" FARINHA   DE TRIGO "))
    assert (
        client.post(ROOT + "/recipes", headers=headers, json=duplicate).status_code
        == 422
    )
    duplicate["items"][1] = {
        "ingredient_id": data["ingredients"][0]["id"],
        "quantity": "1",
        "unit": "g",
    }
    assert (
        client.post(ROOT + "/recipes", headers=headers, json=duplicate).status_code
        == 422
    )
    assert (
        client.post(
            ROOT + "/recipes", headers=headers, json=recipe_payload()
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"name": " "},
        {"quantity": "-1"},
        {"quantity": "NaN"},
        {"quantity": "Infinity"},
        {"quantity": "0.0001"},
        {"unit": "xicara"},
        {"organization_id": str(uuid.uuid4())},
        {"ingredient_name": ""},
        {"ingredient_name": None},
        {"ingredient_id": str(uuid.uuid4())},
    ],
)
def test_invalid_stock_inputs(client, changes):
    headers = login(client)
    payload = {
        "name": "Marca",
        "quantity": "1",
        "unit": "kg",
        "ingredient_name": "Farinha",
    } | changes
    assert (
        client.post(ROOT + "/stock-items", headers=headers, json=payload).status_code
        == 422
    )
    assert overview(client, headers)["stock_items"] == []


def test_duplicate_stock_and_unit_mismatch_preserve_state(client):
    headers = login(client)
    saved = stock(client, headers)
    payload = {
        "name": " farinha santa amalia ",
        "quantity": "1",
        "unit": "kg",
        "ingredient_id": saved["ingredient_id"],
    }
    assert (
        client.post(ROOT + "/stock-items", headers=headers, json=payload).status_code
        == 409
    )
    payload["name"] = "Outra marca"
    payload["unit"] = "L"
    assert (
        client.put(
            ROOT + "/stock-items/" + saved["id"], headers=headers, json=payload
        ).status_code
        == 422
    )
    data = overview(client, headers)
    assert len(data["stock_items"]) == 1
    assert data["stock_items"][0]["unit"] == "kg"


def test_recipe_edit_and_delete_do_not_remove_stock(client):
    headers = login(client)
    saved = stock(client, headers)
    recipe_id = create_recipe(client, headers, recipe_payload(item()))
    payload = recipe_payload(item(quantity="1", unit="kg"), name="Pão atualizado")
    payload["yield_quantity"] = "2.5"
    payload["yield_unit"] = "kg"
    assert (
        client.put(
            ROOT + "/recipes/" + recipe_id, headers=headers, json=payload
        ).status_code
        == 200
    )
    assert Decimal(overview(client, headers)["recipes"][0]["possible_yield"]) == 5
    assert (
        client.delete(ROOT + "/recipes/" + recipe_id, headers=headers).status_code
        == 204
    )
    data = overview(client, headers)
    assert data["recipes"] == []
    assert data["stock_items"][0]["id"] == saved["id"]


def test_tenant_isolation_and_foreign_keys(client, db):
    headers = login(client)
    other = login(client, email="empresa-b@gestoria.dev")
    saved = stock(client, headers)
    recipe_id = create_recipe(client, headers, recipe_payload(item()))
    foreign = stock(client, other)
    assert overview(client, other)["recipes"] == []
    assert overview(client, other)["ingredients"][0]["id"] != saved["ingredient_id"]
    payload = {
        "name": "Outra marca",
        "quantity": "1",
        "unit": "kg",
        "ingredient_id": foreign["ingredient_id"],
    }
    assert (
        client.post(ROOT + "/stock-items", headers=headers, json=payload).status_code
        == 422
    )
    for suffix, body in [
        ("/stock-items/" + saved["id"], payload),
        ("/recipes/" + recipe_id, recipe_payload(item())),
    ]:
        assert client.put(ROOT + suffix, headers=other, json=body).status_code == 404
        assert client.delete(ROOT + suffix, headers=other).status_code == 404
    assert (
        client.post(
            ROOT + "/recipes",
            headers=headers,
            json=recipe_payload(
                {
                    "ingredient_id": foreign["ingredient_id"],
                    "quantity": "1",
                    "unit": "kg",
                }
            ),
        ).status_code
        == 422
    )
    org = uuid.UUID(
        client.get("/api/auth/me", headers=headers).json()["organization"]["id"]
    )
    for entry in [
        RecipeIngredient(
            organization_id=org,
            recipe_id=uuid.UUID(recipe_id),
            ingredient_id=uuid.UUID(foreign["ingredient_id"]),
            quantity=1,
            unit="kg",
        ),
        StockItem(
            organization_id=org,
            ingredient_id=uuid.UUID(foreign["ingredient_id"]),
            name="Invalid",
            name_key="invalid",
            quantity=1,
            unit="kg",
        ),
    ]:
        db.add(entry)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_authentication_and_deletion_permissions(client):
    assert client.get(ROOT).status_code == 401
    headers = login(client)
    saved = stock(client, headers)
    recipe_id = create_recipe(client, headers, recipe_payload(item()))
    member = login(client, email="membro@gestoria.dev")
    for suffix in ["/stock-items/" + saved["id"], "/recipes/" + recipe_id]:
        assert client.delete(ROOT + suffix, headers=member).status_code == 403
