"""HTTP smoke test for a DEVELOPMENT server. Uses only the Python stdlib.

Creates uniquely named customer/product/order records. --cleanup removes these
business records after testing; signed security events remain for inspection.
"""

import argparse
import copy
import getpass
import json
import os
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument(
        "--email", default=os.environ.get("DEMO_EMAIL", "admin@gestoria.dev")
    )
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()
    password = os.environ.get("GESTORIA_TEST_PASSWORD") or getpass.getpass(
        "Senha do usuário de teste: "
    )
    token = None

    def request(method, path, body=None, *, headers=None, expected=200):
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        if token:
            request_headers["Authorization"] = "Bearer " + token
        data = json.dumps(body).encode() if body is not None else None
        req = Request(
            args.base_url.rstrip("/") + path,
            data=data,
            headers=request_headers,
            method=method,
        )
        try:
            response = urlopen(req, timeout=20)
        except HTTPError as exc:
            response = exc
        raw = response.read()
        value = json.loads(raw) if raw else None
        if response.status != expected:
            raise RuntimeError(
                f"{method} {path}: esperado {expected}, recebido {response.status}: {value}"
            )
        return value

    token = request(
        "POST", "/api/auth/login", {"email": args.email, "password": password}
    )["access_token"]
    run_id = uuid.uuid4().hex[:8]
    customer = request(
        "POST",
        "/api/customers",
        {
            "name": f"Teste segurança {run_id}",
            "phone": "35" + str(uuid.uuid4().int % 10**9).zfill(9),
        },
        expected=201,
    )
    product = request(
        "POST",
        "/api/products",
        {
            "name": f"Teste segurança {run_id}",
            "price": "12.50",
            "stock_quantity": "10.000",
        },
        expected=201,
    )
    body = {
        "customer_id": customer["id"],
        "items": [{"product_id": product["id"], "quantity": "2.000"}],
    }
    headers = {"Idempotency-Key": str(uuid.uuid4())}
    proposal = request(
        "POST", "/api/orders/proposals", body, headers=headers, expected=201
    )
    assert (
        request("POST", "/api/orders/proposals", body, headers=headers, expected=201)
        == proposal
    )
    changed = copy.deepcopy(body)
    changed["items"][0]["quantity"] = "3.000"
    request("POST", "/api/orders/proposals", changed, headers=headers, expected=409)
    request("POST", "/api/orders", body, expected=428)
    path = f"/api/orders/proposals/{proposal['operation_id']}"
    changed = copy.deepcopy(proposal["envelope"])
    changed["payload"]["items"][0]["quantity"] = "9.000"
    request("POST", path + "/confirm", {"envelope": changed}, expected=403)
    confirmation = {"envelope": proposal["envelope"]}
    order = request("POST", path + "/confirm", confirmation, expected=201)
    assert request("POST", path + "/confirm", confirmation) == order
    receipt = request("GET", path + "/receipt")
    assert receipt["verified"] and receipt["receipt"]["result"] == order
    stored_product = next(
        p for p in request("GET", "/api/products") if p["id"] == product["id"]
    )
    assert float(stored_product["stock_quantity"]) == 8
    print(
        "PASS: preparação, idempotência, conflito, bloqueio da rota antiga, adulteração, confirmação, repetição, estoque e comprovante."
    )
    print("Operação:", proposal["operation_id"])
    print("Pedido:", order["id"])
    print("Comprovante:", args.base_url.rstrip("/") + path + "/receipt")
    if args.cleanup:
        request("DELETE", "/api/orders/" + order["id"], expected=204)
        request("DELETE", "/api/products/" + product["id"], expected=204)
        request("DELETE", "/api/customers/" + customer["id"], expected=204)
        print("Dados de negócio do teste removidos; auditoria preservada.")


if __name__ == "__main__":
    main()
