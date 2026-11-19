"""CPF/CNPJ conferidos pelos dígitos verificadores em Clientes e Empresa."""

import pytest
from fastapi.testclient import TestClient
from test_api import login

from app.schemas.common import is_valid_cnpj, is_valid_cpf, validate_tax_document


@pytest.mark.parametrize(
    ("document", "valid"),
    [
        ("123.456.789-09", True),
        ("52998224725", True),
        ("12345678901", False),
        ("111.111.111-11", False),
    ],
)
def test_cpf_check_digits(document, valid):
    assert is_valid_cpf(document) is valid


@pytest.mark.parametrize(
    ("document", "valid"),
    [
        ("11.222.333/0001-81", True),
        ("12345678000195", True),
        ("12.345.678/0001-00", False),
        ("11.111.111/1111-11", False),
    ],
)
def test_cnpj_check_digits(document, valid):
    assert is_valid_cnpj(document) is valid


def test_blank_document_becomes_empty_and_wrong_length_is_explained():
    assert validate_tax_document("   ") is None
    assert validate_tax_document(" 123.456.789-09 ") == "123.456.789-09"
    with pytest.raises(ValueError, match="O CPF tem 11 dígitos e o CNPJ tem 14"):
        validate_tax_document("1234")


def customer(client, headers, **fields):
    return client.post(
        "/api/customers",
        headers=headers,
        json={"name": "Cliente", "phone": "35988887777", **fields},
    )


def first_error(response) -> str:
    return response.json()["detail"][0]["msg"]


def test_customer_rejects_invalid_cnpj_and_accepts_valid_one(client: TestClient):
    headers = login(client)

    invalid = customer(
        client, headers, person_type="company", document="11.111.111/1111-11"
    )
    assert invalid.status_code == 422
    assert "CNPJ inválido" in first_error(invalid)

    valid = customer(
        client, headers, person_type="company", document="11.222.333/0001-81"
    )
    assert valid.status_code == 201, valid.text
    # O texto digitado é mantido, com a máscara.
    assert valid.json()["document"] == "11.222.333/0001-81"


def test_customer_document_must_match_person_type(client: TestClient):
    headers = login(client)

    response = customer(client, headers, document="11.222.333/0001-81")

    assert response.status_code == 422
    assert "pessoa jurídica" in first_error(response)


def test_customer_update_validates_document(client: TestClient):
    headers = login(client)
    created = customer(client, headers, document="123.456.789-09").json()

    invalid = client.patch(
        f"/api/customers/{created['id']}",
        headers=headers,
        json={"document": "123.456.789-00"},
    )
    cleared = client.patch(
        f"/api/customers/{created['id']}", headers=headers, json={"document": ""}
    )

    assert invalid.status_code == 422
    assert "CPF inválido" in first_error(invalid)
    assert cleared.status_code == 200
    assert cleared.json()["document"] is None


def test_company_document_and_state_are_validated(client: TestClient):
    headers = login(client)

    invalid = client.patch(
        "/api/organization",
        headers=headers,
        json={"document": "12.345.678/0001-00"},
    )
    valid = client.patch(
        "/api/organization",
        headers=headers,
        json={"document": "12.345.678/0001-95", "state": "mg"},
    )

    assert invalid.status_code == 422
    assert "CNPJ inválido" in first_error(invalid)
    assert valid.status_code == 200, valid.text
    assert valid.json()["document"] == "12.345.678/0001-95"
    assert valid.json()["state"] == "MG"
