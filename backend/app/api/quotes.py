import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import QuoteRepository
from app.schemas import QuoteCreate, QuoteItemRead, QuoteRead, QuoteStatusUpdate
from app.services import (
    CustomerNotFoundError,
    InsufficientStockError,
    ProductNotFoundError,
    QuoteExpiredError,
    QuoteNotConvertibleError,
    QuoteStatusTransitionError,
    convert_quote_to_order,
    create_quote,
    delete_quote_record,
    update_quote_status,
)

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


def quote_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Orçamento não encontrado.")


def _build_quote_read(quote) -> QuoteRead:
    item_reads = [
        QuoteItemRead(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else "Produto removido",
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        for item in quote.items
    ]

    return QuoteRead(
        id=quote.id,
        organization_id=quote.organization_id,
        customer_id=quote.customer_id,
        customer_name=quote.customer.name if quote.customer else "Cliente removido",
        status=quote.status,
        valid_until=quote.valid_until,
        total_amount=quote.total_amount,
        converted_order_id=quote.converted_order_id,
        items=item_reads,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
    )


@router.get("", response_model=list[QuoteRead])
def list_quotes(db: DatabaseSession, current: CurrentUser) -> list[QuoteRead]:
    quotes = QuoteRepository.list_for_organization(db, current.organization.id)
    return [_build_quote_read(quote) for quote in quotes]


@router.post("", response_model=QuoteRead, status_code=status.HTTP_201_CREATED)
def create_quote_route(
    payload: QuoteCreate, db: DatabaseSession, current: CurrentUser
) -> QuoteRead:
    try:
        quote = create_quote(
            db,
            current.organization.id,
            payload.customer_id,
            payload.valid_until,
            payload.items,
        )
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return _build_quote_read(quote)


@router.patch("/{quote_id}", response_model=QuoteRead)
def update_status_route(
    quote_id: uuid.UUID,
    payload: QuoteStatusUpdate,
    db: DatabaseSession,
    current: CurrentUser,
) -> QuoteRead:
    quote = QuoteRepository.get_for_organization(
        db,
        quote_id,
        current.organization.id,
    )
    if not quote:
        raise quote_not_found()

    try:
        quote = update_quote_status(db, quote, payload.status)
    except (QuoteExpiredError, QuoteStatusTransitionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return _build_quote_read(quote)


@router.post("/{quote_id}/convert", response_model=QuoteRead)
def convert_quote_route(
    quote_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> QuoteRead:
    quote = QuoteRepository.get_for_organization(
        db,
        quote_id,
        current.organization.id,
        for_update=True,
    )
    if not quote:
        raise quote_not_found()

    try:
        quote = convert_quote_to_order(db, quote)
    except QuoteNotConvertibleError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except QuoteExpiredError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InsufficientStockError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return _build_quote_read(quote)


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote_route(
    quote_id: uuid.UUID, db: DatabaseSession, current: CurrentUser
) -> Response:
    require_role(current, {"owner", "admin"})

    quote = QuoteRepository.get_for_organization(db, quote_id, current.organization.id)
    if not quote:
        raise quote_not_found()

    delete_quote_record(db, quote)
    return Response(status_code=status.HTTP_204_NO_CONTENT)