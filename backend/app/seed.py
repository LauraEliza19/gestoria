import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Organization, OrganizationMember, User
from app.security import hash_password


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def seed_demo_data(db: Session) -> None:
    slug = slugify(settings.demo_organization)
    organization = db.scalar(select(Organization).where(Organization.slug == slug))
    if not organization:
        organization = Organization(name=settings.demo_organization, slug=slug)
        db.add(organization)
        db.flush()

    email = settings.demo_email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            full_name="Administrador Demo",
            email=email,
            password_hash=hash_password(settings.demo_password),
        )
        db.add(user)
        db.flush()

    membership = db.get(OrganizationMember, (organization.id, user.id))
    if not membership:
        db.add(
            OrganizationMember(
                organization_id=organization.id,
                user_id=user.id,
                role="owner",
            )
        )

    db.commit()


def main() -> None:
    with SessionLocal() as db:
        seed_demo_data(db)
    print(f"Demo user ready: {settings.demo_email}")


if __name__ == "__main__":
    main()
