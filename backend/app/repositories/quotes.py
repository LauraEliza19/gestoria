import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Quote, QuoteItem


class QuoteRepository:
    @staticmethod
    def list_for_organization(db: Session, organization_id: uuid.UUID) -> list[Quote]:
        query = (
            select(Quote)
            .options(
                joinedload(Quote.customer),
                selectinload(Quote.items).joinedload(QuoteItem.product),
        )
        .where(Quote.organization_id == organization_id)
        .order_by(Quote.created_at.desc())
        )
        return list (db.scalars(query).unique())

    @staticmethod
    def get_for_organization(
        db: Session,
        quote_id: uuid.UUID,
        organization_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> Quote | None:
        query = (
            select(Quote)
            .options(
                joinedload(Quote.customer),
                selectinload(Quote.items).joinedload(QuoteItem.product),
            )
            .where(
                Quote.id == quote_id,
                Quote.organization_id == organization_id,
            )
        )

        if for_update:
            query = query.with_for_update(of=Quote)

        return db.scalar(query)


    @staticmethod
    def create(
         db: Session,
         organization_id: uuid.UUID,
         customer_id: uuid.UUID,
         valid_until,
    ) -> Quote:
         quote = Quote(
              organization_id=organization_id,
              customer_id=customer_id,
              status="pending",
              valid_until=valid_until,
              total_amount=0,
         )
         db.add(quote)
         db.flush()
         return quote

    @staticmethod
    def update_status(db: Session, quote: Quote, status: str) -> Quote:
        quote.status = status
        db.commit()
        db.refresh(quote)
        return quote

    @staticmethod
    def mark_converted(
         db: Session,
         quote: Quote,
         order_id: uuid.UUID,
         *,
         commit: bool = True,
    ) -> Quote:
        quote.status = "converted"
        quote.converted_order_id = order_id

        if commit:
            db.commit()
        else:
            db.flush()

        db.refresh(quote)
        return quote

    @staticmethod
    def delete(db: Session, quote: Quote) -> None:
        db.delete(quote)
        db.commit()


class QuoteItemRepository:
    @staticmethod
    def create(
        db: Session,
        quote_id: uuid.UUID,
        product_id: uuid.UUID,
        quantity: Decimal,
        unit_price,
    ) -> QuoteItem:
        item = QuoteItem(
            quote_id=quote_id,
            product_id=product_id,
            quantity=quantity,
            unit_price=unit_price,
        )
        db.add(item)
        db.flush()
        return item