import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Product


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
        db: Session,
        product_id: uuid.UUID,
        organization_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> Product | None:
        query = select(Product).where(
            Product.id == product_id,
            Product.organization_id == organization_id,
        )
        if for_update:
            query = query.with_for_update()
        return db.scalar(query)

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
