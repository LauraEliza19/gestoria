from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization, OrganizationMember, User
from app.seed import seed_demo_data, slugify


def test_slugify_normalizes_name() -> None:
    assert slugify("Empresa Demo GestorIA") == "empresa-demo-gestoria"
    assert slugify("  Padaria Bom Pão  ") == "padaria-bom-p-o"
    assert slugify("***") == ""


def test_seed_demo_data_is_idempotent(db: Session) -> None:
    seed_demo_data(db)
    seed_demo_data(db)

    organizations = list(db.scalars(select(Organization)))
    users = list(db.scalars(select(User).where(User.email == "admin@gestoria.dev")))
    memberships = list(db.scalars(select(OrganizationMember)))

    assert len(organizations) == 3
    assert len(users) == 1
    assert users[0].full_name == "Administrador Demo"
    assert any(
        item.user_id == users[0].id and item.role == "owner" for item in memberships
    )
