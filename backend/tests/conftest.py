import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Organization, OrganizationMember, Product, User
from app.security import hash_password

engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
def database() -> None:
    Base.metadata.create_all(engine)
    with TestingSession() as db:
        seed_test_data(db)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client() -> TestClient:
    def override_get_db():
        with TestingSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def seed_test_data(db: Session) -> None:
    organization = Organization(id=uuid.uuid4(), name="Empresa A", slug="empresa-a")
    other_organization = Organization(
        id=uuid.uuid4(), name="Empresa B", slug="empresa-b"
    )
    user = User(
        id=uuid.uuid4(),
        full_name="Lucas Teste",
        email="lucas@gestoria.dev",
        password_hash=hash_password("SenhaForte@123"),
    )
    db.add_all([organization, other_organization, user])
    db.flush()
    db.add(
        OrganizationMember(
            organization_id=organization.id,
            user_id=user.id,
            role="owner",
        )
    )
    db.add(
        Product(
            organization_id=other_organization.id,
            name="Produto privado da Empresa B",
            price=10,
            stock_quantity=1,
        )
    )
    db.commit()
