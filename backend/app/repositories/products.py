import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Organization, Product
from app.repositories.pagination import paginate


class ProductRepository:
    @staticmethod
    def list_for_organization(
        db: Session,
        organization_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        active_only: bool | None = None,
        sort: str = "created_at",
    ):
        query = select(Product).where(Product.organization_id == organization_id)
        if search:
            term = f"%{search}%"
            query = query.where(or_(Product.name.ilike(term), Product.code.ilike(term)))
        if active_only is not None:
            query = query.where(Product.is_active.is_(active_only))
        ordering = {
            "name": Product.name.asc(),
            "price": Product.price.desc(),
            "created_at": Product.created_at.desc(),
        }[sort]
        query = query.order_by(ordering, Product.id)
        return paginate(db, query, page, page_size)

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
        organization = db.scalar(
            select(Organization)
            .where(Organization.id == organization_id)
            .with_for_update()
        )

        if organization is None:
            raise ValueError("Empresa não encontrada.")

        code = f"PRO-{organization.next_product_code:06d}"
        organization.next_product_code += 1

        product = Product(
            organization_id=organization_id,
            code=code,
            **values,
        )
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
