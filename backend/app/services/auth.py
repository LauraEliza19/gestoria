from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Organization, OrganizationMember, User
from app.repositories import OrganizationRepository, UserRepository
from app.security import verify_password


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    membership: OrganizationMember
    organization: Organization


def authenticate(db: Session, email: str, password: str) -> AuthenticatedUser | None:
    user = UserRepository.get_by_email(db, email)
    if (
        not user
        or not user.is_active
        or not verify_password(password, user.password_hash)
    ):
        return None

    membership = UserRepository.get_membership(db, user.id)
    if not membership:
        return None

    organization = OrganizationRepository.get_by_id(db, membership.organization_id)
    if not organization:
        return None

    return AuthenticatedUser(user, membership, organization)
