"""Cadastro de fornecedores: contato, edição, permissões e isolamento por empresa."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from test_api import login, page_items
from test_fiscal_integrity import URL as FISCAL_URL
from test_fiscal_integrity import create as create_document
from test_fiscal_integrity import incoming

from app.models import Supplier

URL = "/api/fiscal-suppliers"
CNPJ = "11222333000181"
OTHER_CNPJ = "45723174000110"
CPF = "11144477735"
DUPLICATE = "Já existe um fornecedor com este CPF/CNPJ nesta empresa."


def new_supplier(client, headers, **overrides):
    body = {"name": "Moinho Central", "document": CNPJ, **overrides}
    response = client.post(URL, headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_supplier_listing_requires_authentication(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
    assert client.get(f"{URL}/{uuid.uuid4()}").status_code == 401


def test_supplier_keeps_working_with_name_and_document_only(
    client: TestClient,
) -> None:
    headers = login(client)

    supplier = new_supplier(client, headers)

    assert supplier["name"] == "Moinho Central"
    assert supplier["document"] == CNPJ
    assert supplier["phone"] is None
    assert supplier["email"] is None
    assert supplier["is_active"] is True


def test_supplier_stores_normalized_phone_and_email(client: TestClient, db) -> None:
    headers = login(client)

    supplier = new_supplier(
        client,
        headers,
        phone="(35) 99999-8888",
        email="compras@fornecedor.com.br",
    )

    assert supplier["phone"] == "35999998888"
    assert supplier["email"] == "compras@fornecedor.com.br"

    stored = db.scalar(select(Supplier).where(Supplier.id == uuid.UUID(supplier["id"])))
    assert stored.phone == "35999998888"
    assert stored.email == "compras@fornecedor.com.br"

    fetched = client.get(f"{URL}/{supplier['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json() == supplier

    listed = page_items(client.get(URL, headers=headers))
    assert listed == [supplier]


def test_blank_contact_is_stored_as_missing(client: TestClient) -> None:
    headers = login(client)

    supplier = new_supplier(client, headers, phone="  ", email="")

    assert supplier["phone"] is None
    assert supplier["email"] is None


@pytest.mark.parametrize(
    "body",
    (
        {"name": "A", "document": "1234567890"},
        {"name": "A", "document": "11.222.333/0001-81"},
        {"name": "", "document": CNPJ},
        {"document": CNPJ},
        {"name": "A"},
        {"name": "A", "document": CNPJ, "phone": "12345"},
        {"name": "A", "document": CNPJ, "phone": "1" * 16},
        {"name": "A", "document": CNPJ, "email": "sem-arroba"},
        {"name": "A", "document": CNPJ, "is_active": False},
        {"name": "A", "document": CNPJ, "organization_id": str(uuid.uuid4())},
    ),
)
def test_supplier_creation_rejects_invalid_payloads(client: TestClient, body) -> None:
    headers = login(client)

    assert client.post(URL, headers=headers, json=body).status_code == 422
    assert page_items(client.get(URL, headers=headers)) == []


def test_duplicate_document_has_a_supplier_specific_message(
    client: TestClient,
) -> None:
    headers = login(client)
    first = new_supplier(client, headers)

    duplicate = client.post(
        URL, headers=headers, json={"name": "Outro nome", "document": CNPJ}
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == DUPLICATE
    assert page_items(client.get(URL, headers=headers)) == [first]

    # A sessão continua utilizável depois do conflito.
    second = new_supplier(client, headers, name="Distribuidora Sul", document=CPF)
    assert second["document"] == CPF


def test_same_document_is_allowed_in_another_company(client: TestClient) -> None:
    headers = login(client)
    other = login(client, "empresa-b@gestoria.dev")
    mine = new_supplier(client, headers)

    theirs = new_supplier(client, other, name="Fornecedor da Empresa B")

    assert theirs["id"] != mine["id"]
    assert theirs["organization_id"] != mine["organization_id"]
    assert page_items(client.get(URL, headers=headers)) == [mine]
    assert page_items(client.get(URL, headers=other)) == [theirs]


def test_supplier_can_be_edited_field_by_field(client: TestClient) -> None:
    headers = login(client)
    supplier = new_supplier(client, headers, phone="3537221234")
    path = f"{URL}/{supplier['id']}"

    renamed = client.patch(path, headers=headers, json={"name": "Moinho Central Ltda"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json() == {**supplier, "name": "Moinho Central Ltda"}

    contact = client.patch(
        path,
        headers=headers,
        json={"phone": "(35) 98888-7777", "email": "fiscal@moinho.com.br"},
    )
    assert contact.status_code == 200, contact.text
    assert contact.json()["phone"] == "35988887777"
    assert contact.json()["email"] == "fiscal@moinho.com.br"
    assert contact.json()["name"] == "Moinho Central Ltda"

    document = client.patch(path, headers=headers, json={"document": OTHER_CNPJ})
    assert document.status_code == 200, document.text
    assert document.json()["document"] == OTHER_CNPJ

    cleared = client.patch(path, headers=headers, json={"phone": None, "email": ""})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["phone"] is None
    assert cleared.json()["email"] is None

    saved = client.get(path, headers=headers).json()
    assert saved == {
        **supplier,
        "name": "Moinho Central Ltda",
        "document": OTHER_CNPJ,
        "phone": None,
        "email": None,
    }


def test_supplier_can_be_deactivated_and_reactivated(client: TestClient) -> None:
    headers = login(client)
    supplier = new_supplier(client, headers)
    path = f"{URL}/{supplier['id']}"

    disabled = client.patch(path, headers=headers, json={"is_active": False})
    assert disabled.status_code == 200
    assert disabled.json() == {**supplier, "is_active": False}
    active = {"active_only": True}
    assert page_items(client.get(URL, params=active, headers=headers)) == []
    assert page_items(client.get(URL, headers=headers)) == [disabled.json()]

    enabled = client.patch(path, headers=headers, json={"is_active": True})
    assert enabled.status_code == 200
    assert page_items(client.get(URL, params=active, headers=headers)) == [supplier]


@pytest.mark.parametrize(
    "body",
    (
        {},
        {"name": None},
        {"document": None},
        {"is_active": None},
        {"name": ""},
        {"document": "123"},
        {"phone": "123"},
        {"email": "invalido"},
        {"id": str(uuid.uuid4())},
        {"organization_id": str(uuid.uuid4())},
    ),
)
def test_supplier_update_rejects_invalid_payloads(client: TestClient, body) -> None:
    headers = login(client)
    supplier = new_supplier(client, headers, phone="3537221234")
    path = f"{URL}/{supplier['id']}"

    assert client.patch(path, headers=headers, json=body).status_code == 422
    assert client.get(path, headers=headers).json() == supplier


def test_update_cannot_take_the_document_of_another_supplier(
    client: TestClient,
) -> None:
    headers = login(client)
    first = new_supplier(client, headers)
    second = new_supplier(client, headers, name="Distribuidora Sul", document=CPF)

    conflict = client.patch(
        f"{URL}/{second['id']}", headers=headers, json={"document": CNPJ}
    )

    assert conflict.status_code == 409
    assert conflict.json()["detail"] == DUPLICATE
    assert client.get(f"{URL}/{second['id']}", headers=headers).json() == second
    assert client.get(f"{URL}/{first['id']}", headers=headers).json() == first

    # Reenviar o próprio documento não é conflito.
    same = client.patch(
        f"{URL}/{second['id']}", headers=headers, json={"document": CPF}
    )
    assert same.status_code == 200


def test_member_can_read_but_not_change_suppliers(client: TestClient) -> None:
    owner = login(client)
    supplier = new_supplier(client, owner)
    member = login(client, "membro@gestoria.dev")
    path = f"{URL}/{supplier['id']}"

    assert page_items(client.get(URL, headers=member)) == [supplier]
    assert client.get(path, headers=member).json() == supplier

    created = client.post(
        URL, headers=member, json={"name": "Sem permissão", "document": CPF}
    )
    assert created.status_code == 403
    for change in ({"name": "X"}, {"is_active": False}):
        assert client.patch(path, headers=member, json=change).status_code == 403
    assert page_items(client.get(URL, headers=owner)) == [supplier]


def test_suppliers_are_isolated_between_companies(client: TestClient) -> None:
    headers = login(client)
    other = login(client, "empresa-b@gestoria.dev")
    supplier = new_supplier(client, headers)
    path = f"{URL}/{supplier['id']}"

    assert client.get(path, headers=other).status_code == 404
    invaded = client.patch(path, headers=other, json={"name": "Invadido"})
    assert invaded.status_code == 404
    assert page_items(client.get(URL, headers=other)) == []
    assert client.get(path, headers=headers).json() == supplier


def test_unknown_supplier_returns_not_found(client: TestClient) -> None:
    headers = login(client)
    missing = f"{URL}/{uuid.uuid4()}"

    assert client.get(missing, headers=headers).status_code == 404
    patched = client.patch(missing, headers=headers, json={"name": "X"})
    assert patched.status_code == 404
    assert client.get(f"{URL}/nao-e-uuid", headers=headers).status_code == 422


def test_supplier_search_matches_name_and_document(client: TestClient) -> None:
    headers = login(client)
    mill = new_supplier(client, headers)
    dairy = new_supplier(client, headers, name="Laticínios Serra", document=CPF)

    by_name = client.get(URL, params={"search": "serra"}, headers=headers)
    by_document = client.get(URL, params={"search": "112223"}, headers=headers)
    everything = client.get(URL, params={"sort": "name"}, headers=headers)

    assert page_items(by_name) == [dairy]
    assert page_items(by_document) == [mill]
    assert page_items(everything) == [dairy, mill]


def test_editing_a_supplier_never_rewrites_registered_documents(
    client: TestClient,
) -> None:
    headers = login(client)
    product = client.post(
        "/api/products",
        headers=headers,
        json={"name": "Farinha", "price": "10.00", "stock_quantity": 5},
    )
    assert product.status_code == 201, product.text
    body = incoming(client, headers, product.json())
    document = create_document(client, headers, body)
    assert document["participant_name"] == "Fornecedor fiscal"
    assert document["participant_document"] == "12345678000190"

    edited = client.patch(
        f"{URL}/{body['supplier_id']}",
        headers=headers,
        json={"name": "Fornecedor renomeado", "document": CNPJ},
    )
    assert edited.status_code == 200, edited.text

    saved = client.get(f"{FISCAL_URL}/{document['id']}", headers=headers).json()
    assert saved["participant_name"] == "Fornecedor fiscal"
    assert saved["participant_document"] == "12345678000190"
    assert saved["supplier_id"] == body["supplier_id"]

    # Notas novas passam a usar o cadastro atualizado.
    later = create_document(client, headers, {**body, "number": "201"})
    assert later["participant_name"] == "Fornecedor renomeado"
    assert later["participant_document"] == CNPJ
