import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.api.dependencies import CurrentUser, DatabaseSession, require_role
from app.repositories import QuoteRepository
from app.schemas import QuoteCreate, QuoteRead, QuoteStatusUpdate
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
from app.services.quote_serialization import quote_to_read

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


def quote_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Orçamento não encontrado.",
    )


@router.get(
    "",
    response_model=list[QuoteRead],
)
def list_quotes(
    db: DatabaseSession,
    current: CurrentUser,
) -> list[QuoteRead]:
    quotes = QuoteRepository.list_for_organization(
        db,
        current.organization.id,
    )
    return [quote_to_read(quote) for quote in quotes]


@router.post(
    "",
    response_model=QuoteRead,
    status_code=status.HTTP_201_CREATED,
)
def create_quote_route(
    payload: QuoteCreate,
    db: DatabaseSession,
    current: CurrentUser,
) -> QuoteRead:
    try:
        quote = create_quote(
            db,
            current.organization.id,
            payload.customer_id,
            payload.valid_until,
            payload.items,
            general_discount_percent=payload.general_discount_percent,
            payment_terms=payload.payment_terms,
            installment_count=payload.installment_count,
        )
    except (
        CustomerNotFoundError,
        ProductNotFoundError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return quote_to_read(quote)


@router.patch(
    "/{quote_id}",
    response_model=QuoteRead,
)
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
        quote = update_quote_status(
            db,
            quote,
            payload.status,
        )
    except (
        QuoteExpiredError,
        QuoteStatusTransitionError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return quote_to_read(quote)


@router.post(
    "/{quote_id}/convert",
    response_model=QuoteRead,
)
def convert_quote_route(
    quote_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
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
        quote = convert_quote_to_order(
            db,
            quote,
        )
    except (
        QuoteNotConvertibleError,
        QuoteExpiredError,
        InsufficientStockError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except (
        CustomerNotFoundError,
        ProductNotFoundError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return quote_to_read(quote)


@router.delete(
    "/{quote_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_quote_route(
    quote_id: uuid.UUID,
    db: DatabaseSession,
    current: CurrentUser,
) -> Response:
    require_role(current, {"owner", "admin"})

    quote = QuoteRepository.get_for_organization(
        db,
        quote_id,
        current.organization.id,
    )

    if not quote:
        raise quote_not_found()

    delete_quote_record(db, quote)

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )
