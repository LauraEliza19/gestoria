import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization, OrganizationMember, Product, User


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


class ProductRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID) -> list[Product]:
        query = (
            select(Product)
            .where(Product.organization_id == organization_id)
            .order_by(Product.created_at.desc())
        )
        return list(db.scalars(query))

    @staticmethod
    def get_for_organization(
        db: Session, product_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Product | None:
        return db.scalar(
            select(Product).where(
                Product.id == product_id,
                Product.organization_id == organization_id,
            )
        )

    @staticmethod
    def create(db: Session, organization_id: uuid.UUID, values: dict) -> Product:
        product = Product(organization_id=organization_id, **values)
        db.add(product)
        db.commit()
        db.refresh(product)
        return product

    @staticmethod
    def update(db: Session, product: Product, values: dict) -> Product:
        for field, value in values.items():
            setattr(product, field, value)
        db.commit()
        db.refresh(product)
        return product

    @staticmethod
    def delete(db: Session, product: Product) -> None:
        db.delete(product)
        db.commit()
