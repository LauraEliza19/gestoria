from sqlalchemy.orm import Session

from app.models import User
from app.repositories import UserRepository
from app.security import hash_password
from app.services import authenticate


def test_authenticate_returns_user_membership_and_organization(db: Session) -> None:
    authenticated = authenticate(db, "lucas@gestoria.dev", "SenhaForte@123")

    assert authenticated is not None
    assert authenticated.user.email == "lucas@gestoria.dev"
    assert authenticated.membership.role == "owner"
    assert authenticated.organization.slug == "empresa-a"


def test_authenticate_accepts_email_with_spaces_and_different_case(
    db: Session,
) -> None:
    authenticated = authenticate(db, "  Lucas@GestorIA.dev  ", "SenhaForte@123")

    assert authenticated is not None
    assert authenticated.user.email == "lucas@gestoria.dev"


def test_authenticate_rejects_wrong_password_and_unknown_email(db: Session) -> None:
    assert authenticate(db, "lucas@gestoria.dev", "senha-errada") is None
    assert authenticate(db, "naoexiste@gestoria.dev", "SenhaForte@123") is None


def test_authenticate_rejects_inactive_user(db: Session) -> None:
    user = UserRepository.get_by_email(db, "lucas@gestoria.dev")
    assert user is not None
    user.is_active = False
    db.commit()

    assert authenticate(db, "lucas@gestoria.dev", "SenhaForte@123") is None


def test_authenticate_rejects_user_without_membership(db: Session) -> None:
    db.add(
        User(
            full_name="Sem Empresa",
            email="solto@gestoria.dev",
            password_hash=hash_password("SenhaForte@123"),
        )
    )
    db.commit()

    assert authenticate(db, "solto@gestoria.dev", "SenhaForte@123") is None
