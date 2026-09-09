"""Measure ASGI endpoints on an isolated SQLite database; no production DB/network."""

import argparse
import json
import math
import platform
import secrets
import statistics
import sys
import uuid
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import Customer, Organization, OrganizationMember, Product, User
from app.security import create_access_token


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iterations", type=int, default=50)
    parser.add_argument("--output")
    args = parser.parse_args()
    if not 5 <= args.iterations <= 1000:
        parser.error("--iterations deve estar entre 5 e 1000")
    settings.operation_signing_keys = json.dumps({"bench": secrets.token_hex(32)})
    settings.operation_active_key_id = "bench"
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        org = Organization(name="Benchmark isolado", slug="benchmark")
        user = User(
            email="benchmark@example.test",
            full_name="Benchmark",
            password_hash="login-disabled",
        )
        db.add_all([org, user])
        db.flush()
        db.add(
            OrganizationMember(organization_id=org.id, user_id=user.id, role="owner")
        )
        customer = Customer(
            organization_id=org.id, name="Cliente sintético", phone="35900000000"
        )
        product = Product(
            organization_id=org.id,
            name="Produto sintético",
            price=12.50,
            stock_quantity=args.iterations + 10,
        )
        db.add_all([customer, product])
        db.flush()
        token = create_access_token(str(user.id), str(org.id))
        body = {
            "customer_id": str(customer.id),
            "items": [{"product_id": str(product.id), "quantity": "1.000"}],
        }
        db.commit()

    def sessions():
        with Session(engine, expire_on_commit=False) as db:
            yield db

    app.dependency_overrides[get_db] = sessions
    samples = {name: [] for name in ["prepare_ms", "confirm_ms", "replay_ms"]}
    with TestClient(app) as client:
        for i in range(args.iterations + 5):
            headers = {
                "Authorization": "Bearer " + token,
                "Idempotency-Key": str(uuid.uuid4()),
            }
            start = perf_counter()
            proposal_response = client.post(
                "/api/orders/proposals", headers=headers, json=body
            )
            prepared = perf_counter()
            assert proposal_response.status_code == 201, proposal_response.text
            proposal = proposal_response.json()
            path = f"/api/orders/proposals/{proposal['operation_id']}/confirm"
            start_confirm = perf_counter()
            confirmation = client.post(
                path, headers=headers, json={"envelope": proposal["envelope"]}
            )
            confirmed = perf_counter()
            assert confirmation.status_code == 201, confirmation.text
            start_retry = perf_counter()
            replay = client.post(
                path, headers=headers, json={"envelope": proposal["envelope"]}
            )
            retried = perf_counter()
            assert replay.status_code == 200
            if i >= 5:
                for key, elapsed in [
                    ("prepare_ms", prepared - start),
                    ("confirm_ms", confirmed - start_confirm),
                    ("replay_ms", retried - start_retry),
                ]:
                    samples[key].append(elapsed * 1000)
    result = {
        "python": platform.python_version(),
        "platform": platform.system(),
        "iterations": args.iterations,
        "method": "ASGI TestClient, SQLite in-memory, one item/order, 5 warmups; includes API/auth/DB/audit, excludes network and human review; not a baseline comparison.",
        "results": {
            key: {
                "p50_ms": round(statistics.median(values), 3),
                "p95_ms": round(sorted(values)[math.ceil(0.95 * len(values)) - 1], 3),
            }
            for key, values in samples.items()
        },
    }
    rendered = json.dumps(result, indent=2, ensure_ascii=False)
    print(rendered)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    app.dependency_overrides.clear()
    engine.dispose()


if __name__ == "__main__":
    main()
