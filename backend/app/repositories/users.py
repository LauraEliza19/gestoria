import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization, OrganizationMember, User


class UserRepository:
    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(User.email == email.strip().lower()))

    @staticmethod
    def get_by_id(db: Session, user_id: uuid.UUID) -> User | None:
        return db.get(User, user_id)
    

    @staticmethod
    def get_membership(
        db: Session, user_id: uuid.UUID, organization_id: uuid.UUID | None = None
    ) -> OrganizationMember | None:
        query = select(OrganizationMember).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active.is_(True),
        )
        if organization_id:
            query = query.where(OrganizationMember.organization_id == organization_id)
        return db.scalar(query.order_by(OrganizationMember.created_at))


class OrganizationRepository:
    @staticmethod
    def get_by_id(db: Session, organization_id: uuid.UUID) -> Organization | None:
        return db.get(Organization, organization_id)

    @staticmethod
    def update(db: Session, organization: Organization, values: dict) -> Organization:
        for field, value in values.items():
            setattr(organization, field, value)
        db.commit()
        db.refresh(organization)
        return organization