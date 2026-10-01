from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Organization, OrganizationMember, User
from app.repositories import OrganizationRepository, UserRepository
from app.security import hash_password, verify_password

# Equal password-hashing work for unknown and known accounts.
_DUMMY_HASH = hash_password("dummy-password-never-used-to-login")


def is_demo_account(user: User) -> bool:
    return (
        user.email.lower()
        in {"admin@gestoria.dev", "pitch@gestoria.dev", settings.demo_email.lower()}
        or user.full_name == "Administrador Demo"
    )


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    membership: OrganizationMember
    organization: Organization


def authenticate(db: Session, email: str, password: str) -> AuthenticatedUser | None:
    user = UserRepository.get_by_email(db, email)
    valid_password = verify_password(
        password, user.password_hash if user else _DUMMY_HASH
    )
    if not user or not user.is_active or not valid_password:
        return None
    if settings.app_env == "production" and is_demo_account(user):
        return None

    membership = UserRepository.get_membership(db, user.id)
    if not membership or not membership.is_active:
        return None

    organization = OrganizationRepository.get_by_id(db, membership.organization_id)
    if not organization:
        return None

    return AuthenticatedUser(user, membership, organization)
