"""Internal document registration, not a SEFAZ issuer or authorization provider."""

from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import (
    Customer,
    FiscalDocument,
    FiscalDocumentItem,
    FiscalEvent,
    FiscalStockMovement,
    OrganizationMember,
    Product,
    Supplier,
    User,
)
from app.repositories import FiscalDocumentRepository, OrderRepository
from app.schemas.fiscal import FiscalDocumentCreate, FiscalDocumentRead

ACTIVE_STATUSES = ("Em processamento", "Autorizada")
TRANSITIONS = {
    "Em processamento": (
        "Autorizada",
        "Rejeitada",
        "Inutilizada",
        "Denegada",
        "Cancelada",
    ),
    "Autorizada": ("Cancelada",),
    "Rejeitada": ("Em processamento", "Inutilizada"),
    "Cancelada": (),
    "Inutilizada": (),
    "Denegada": (),
}


class FiscalError(Exception):
    def __init__(self, message, status=409):
        super().__init__(message)
        self.status = status


def now():
    return datetime.now(timezone.utc)


def aware(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def authorize(db, current):
    user = db.scalar(
        select(User)
        .where(User.id == current.user.id)
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    member = db.scalar(
        select(OrganizationMember)
        .where(
            OrganizationMember.organization_id == current.organization.id,
            OrganizationMember.user_id == current.user.id,
        )
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    if (
        not user
        or not user.is_active
        or not member
        or not member.is_active
        or member.role not in {"owner", "admin"}
    ):
        raise FiscalError(
            "Você não possui permissão para alterar registros fiscais.", 403
        )


def read_document(document):
    result = FiscalDocumentRead.model_validate(document)
    result.allowed_statuses = list(TRANSITIONS[document.status])
    # Unknown historical items must be reconciled before authorization/retry.
    if document.snapshot_source == "legacy_unverified":
        result.allowed_statuses = [
            s for s in result.allowed_statuses if s not in ACTIVE_STATUSES
        ]
    return result


def event(db, document, actor_id, action, **detail):
    document.updated_by_id = actor_id
    entry = FiscalEvent(
        organization_id=document.organization_id,
        document_id=document.id,
        actor_id=actor_id,
        action=action,
        detail=detail,
    )
    db.add(entry)


def finish(db, document):
    db.commit()
    db.expire_all()
    return FiscalDocumentRepository.get_for_organization(
        db, document.id, document.organization_id
    )


def lock_order(db, order_id, org_id):
    order = OrderRepository.get_for_organization(db, order_id, org_id, for_update=True)
    if not order:
        raise FiscalError("Pedido não encontrado nesta empresa.", 404)
    return order


def locked_document(db, document_id, org_id):
    document = FiscalDocumentRepository.get_for_organization(db, document_id, org_id)
    if not document:
        raise FiscalError("Documento fiscal não encontrado.", 404)
    original_order_id = document.order_id
    if original_order_id:
        lock_order(db, original_order_id, org_id)
    # A no-op UPDATE obtains a write lock also on SQLite. Reload after waiting.
    db.execute(
        update(FiscalDocument)
        .where(
            FiscalDocument.id == document_id, FiscalDocument.organization_id == org_id
        )
        .values(updated_at=FiscalDocument.updated_at)
        .execution_options(synchronize_session=False)
    )
    document = FiscalDocumentRepository.get_for_organization(
        db, document_id, org_id, for_update=True
    )
    if document.order_id != original_order_id:
        raise FiscalError(
            "O vínculo foi atualizado por outra operação. Recarregue e tente novamente."
        )
    return document


def add_item(db, document, product, quantity, unit_price):
    item = FiscalDocumentItem(
        organization_id=document.organization_id,
        document_id=document.id,
        product_id=product.id,
        product_name=product.name,
        unit_of_measure=product.unit_of_measure,
        quantity=quantity,
        unit_price=unit_price,
        total=quantity * unit_price,
        fiscal_snapshot={
            "ncm_code": product.ncm_code,
            "cest_code": product.cest_code,
            "fiscal_origin": product.fiscal_origin,
        },
    )
    db.add(item)


def order_items(db, document, order):
    if not order.items:
        raise FiscalError("Pedido sem itens não pode originar documento fiscal.")
    total = sum((i.quantity * i.unit_price for i in order.items), Decimal(0)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if total != order.total_amount:
        raise FiscalError(
            "O total do pedido diverge dos itens. Corrija o pedido antes de registrar a nota."
        )
    for item in sorted(order.items, key=lambda i: str(i.product_id)):
        product = db.scalar(
            select(Product)
            .where(
                Product.id == item.product_id,
                Product.organization_id == document.organization_id,
            )
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )
        if not product:
            raise FiscalError("Item do pedido pertence a outra empresa ou não existe.")
        add_item(db, document, product, item.quantity, item.unit_price)


def check_active(db, org_id, order_id, exclude=None):
    query = select(FiscalDocument.id).where(
        FiscalDocument.organization_id == org_id,
        FiscalDocument.order_id == order_id,
        FiscalDocument.document_type == "saida",
        FiscalDocument.status.in_(ACTIVE_STATUSES),
    )
    if exclude:
        query = query.where(FiscalDocument.id != exclude)
    if db.scalar(query.limit(1)):
        raise FiscalError(
            "Já existe nota de saída ativa para este pedido. Resolva a nota existente antes de reemitir."
        )


def create_document(db: Session, current, payload: FiscalDocumentCreate):
    authorize(db, current)
    org_id, actor = current.organization.id, current.user.id
    values = payload.model_dump(exclude={"items"})
    if payload.issue_date > now().date():
        raise FiscalError("A data de emissão não pode estar no futuro.", 422)
    document = FiscalDocument(
        **values,
        organization_id=org_id,
        created_by_id=actor,
        updated_by_id=actor,
        status="Em processamento",
        is_legacy=False
    )
    if payload.document_type == "saida":
        order = lock_order(db, payload.order_id, org_id)
        if order.status == "cancelled":
            raise FiscalError("Pedido cancelado não pode originar uma nova nota.")
        check_active(db, org_id, order.id)
        orphan = db.scalar(
            select(FiscalDocument.id)
            .where(
                FiscalDocument.organization_id == org_id,
                FiscalDocument.document_type == "saida",
                FiscalDocument.order_id.is_(None),
                FiscalDocument.status.in_(ACTIVE_STATUSES),
            )
            .limit(1)
        )
        if orphan:
            raise FiscalError(
                "Existem notas de saída antigas ativas sem pedido. Concilie esses registros antes de criar novas saídas."
            )
        customer = db.scalar(
            select(Customer)
            .where(Customer.id == order.customer_id, Customer.organization_id == org_id)
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )
        if not customer:
            raise FiscalError(
                "Destinatário do pedido não encontrado nesta empresa.", 404
            )
        document.customer_id = customer.id
        document.participant_name = customer.name
        document.participant_document = customer.document
        document.value = order.total_amount
        document.snapshot_source = "order"
        db.add(document)
        db.flush()
        order_items(db, document, order)
    else:
        supplier = db.scalar(
            select(Supplier)
            .where(
                Supplier.id == payload.supplier_id, Supplier.organization_id == org_id
            )
            .with_for_update(read=True)
        )
        if not supplier or not supplier.is_active:
            raise FiscalError("Fornecedor ativo não encontrado nesta empresa.", 404)
        ids = [i.product_id for i in payload.items]
        if len(ids) != len(set(ids)):
            raise FiscalError("Informe cada produto uma única vez na entrada.", 422)
        total = sum(
            (i.quantity * i.unit_price for i in payload.items), Decimal(0)
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if total > Decimal("9999999999.99"):
            raise FiscalError("Valor da nota acima do limite.", 422)
        document.participant_name = supplier.name
        document.participant_document = supplier.document
        document.value = total
        document.snapshot_source = "manual_entry"
        db.add(document)
        db.flush()
        for item in sorted(payload.items, key=lambda i: str(i.product_id)):
            product = db.scalar(
                select(Product)
                .where(Product.id == item.product_id, Product.organization_id == org_id)
                .with_for_update(read=True)
            )
            if not product or not product.is_active:
                raise FiscalError("Produto ativo não encontrado nesta empresa.", 404)
            add_item(db, document, product, item.quantity, item.unit_price)
    event(
        db,
        document,
        actor,
        "created",
        status=document.status,
        source=document.snapshot_source,
        order_id=str(document.order_id) if document.order_id else None,
    )
    return finish(db, document)


def change_status(db, current, document_id, payload):
    authorize(db, current)
    document = locked_document(db, document_id, current.organization.id)
    if payload.status == document.status:
        # Repeating an event never replaces its original date, protocol or reason.
        if payload.status in {"Autorizada", "Cancelada"}:
            date_field = (
                document.authorized_at
                if payload.status == "Autorizada"
                else document.cancelled_at
            )
            protocol = (
                document.authorization_protocol
                if payload.status == "Autorizada"
                else document.cancellation_protocol
            )
            if (
                not date_field
                or aware(date_field) != payload.occurred_at
                or protocol != payload.protocol
                or (
                    payload.status == "Cancelada"
                    and document.cancellation_reason != payload.reason
                )
            ):
                raise FiscalError("O evento já foi registrado com outros dados.")
        if payload.access_key and payload.access_key != document.access_key:
            raise FiscalError("A chave de acesso registrada não pode ser substituída.")
        return finish(db, document)
    allowed = read_document(document).allowed_statuses
    if payload.status not in allowed:
        raise FiscalError(
            "Transição fiscal não permitida. Registros cancelados permanecem no histórico; reemita em um novo registro."
        )
    if payload.occurred_at:
        if (
            payload.occurred_at > now() + timedelta(minutes=5)
            or payload.occurred_at.date() < document.issue_date
        ):
            raise FiscalError(
                "A data do evento deve ser posterior à emissão e não pode estar no futuro.",
                422,
            )
        if (
            document.authorized_at
            and payload.status == "Cancelada"
            and payload.occurred_at < aware(document.authorized_at)
        ):
            raise FiscalError("Cancelamento não pode anteceder a autorização.", 422)
    if payload.status in ACTIVE_STATUSES and document.document_type == "saida":
        order = lock_order(db, document.order_id, current.organization.id)
        if order.status == "cancelled":
            raise FiscalError("Pedido cancelado não pode ter nota ativa.")
        check_active(db, current.organization.id, order.id, exclude=document.id)
    previous = document.status
    if payload.status == "Autorizada":
        document.authorized_at = payload.occurred_at
        document.authorization_protocol = payload.protocol
    if payload.status == "Cancelada":
        if previous == "Autorizada" and not payload.protocol:
            raise FiscalError("Informe o protocolo do cancelamento externo.", 422)
        if document.document_type == "entrada" and document.stock_received_at:
            move_stock(db, document, current.user.id, reverse=True)
        document.cancelled_at = payload.occurred_at
        document.cancellation_protocol = payload.protocol
        document.cancellation_reason = payload.reason
    if payload.access_key:
        if document.access_key and document.access_key != payload.access_key:
            raise FiscalError("A chave de acesso registrada não pode ser substituída.")
        document.access_key = payload.access_key
    document.status = payload.status
    event(
        db,
        document,
        current.user.id,
        "status_changed",
        previous=previous,
        status=payload.status,
        occurred_at=payload.occurred_at.isoformat() if payload.occurred_at else None,
        protocol=payload.protocol,
        reason=payload.reason,
    )
    return finish(db, document)


def move_stock(db, document, actor_id, *, reverse=False):
    for item in sorted(document.items, key=lambda i: str(i.product_id)):
        product = db.scalar(
            select(Product)
            .where(
                Product.id == item.product_id,
                Product.organization_id == document.organization_id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if not product or (not reverse and not product.is_active):
            raise FiscalError("Produto indisponível para recebimento.", 409)
        quantity = -item.quantity if reverse else item.quantity
        new_stock = product.stock_quantity + quantity
        if new_stock < 0:
            raise FiscalError(
                "O estoque já foi utilizado. Regularize-o antes de cancelar esta entrada."
            )
        if new_stock > Decimal("9999999.999"):
            raise FiscalError("Recebimento excede o limite de estoque do produto.")
        product.stock_quantity = new_stock
        db.add(
            FiscalStockMovement(
                organization_id=document.organization_id,
                document_id=document.id,
                item_id=item.id,
                product_id=product.id,
                actor_id=actor_id,
                movement_type="reversal" if reverse else "receipt",
                quantity=quantity,
            )
        )


def receive_stock(db, current, document_id):
    authorize(db, current)
    document = locked_document(db, document_id, current.organization.id)
    if document.document_type != "entrada" or document.status != "Autorizada":
        raise FiscalError("Recebimento exige nota de entrada autorizada.")
    if document.stock_received_at:
        return finish(db, document)
    if document.is_legacy or not document.items or not document.supplier_id:
        raise FiscalError(
            "Entrada histórica não gera estoque automaticamente. É necessária conciliação de inventário."
        )
    move_stock(db, document, current.user.id)
    document.stock_received_at = now()
    event(db, document, current.user.id, "stock_received", items=len(document.items))
    return finish(db, document)


def link_legacy_order(db, current, document_id, payload):
    authorize(db, current)
    original = FiscalDocumentRepository.get_for_organization(
        db, document_id, current.organization.id
    )
    if not original:
        raise FiscalError("Documento fiscal não encontrado.", 404)
    if original.order_id and original.order_id != payload.order_id:
        raise FiscalError("O pedido já vinculado não pode ser substituído.")
    order = lock_order(db, payload.order_id, current.organization.id)
    document = locked_document(db, document_id, current.organization.id)
    if not document.is_legacy or document.document_type != "saida":
        raise FiscalError("Conciliação disponível apenas para saídas históricas.")
    if document.order_id and document.order_id != order.id:
        raise FiscalError("O pedido já vinculado não pode ser substituído.")
    if document.snapshot_source == "reconciled_order":
        return finish(db, document)
    if document.status in ACTIVE_STATUSES:
        if order.status == "cancelled":
            raise FiscalError("Nota ativa não pode ser vinculada a pedido cancelado.")
        check_active(db, document.organization_id, order.id, exclude=document.id)
    if document.value != order.total_amount:
        raise FiscalError(
            "O valor histórico da nota não corresponde ao total do pedido."
        )
    customer = order.customer
    if customer.organization_id != current.organization.id:
        raise FiscalError("Destinatário fora da empresa.", 404)
    old_id = "".join(c for c in (document.participant_document or "") if c.isdigit())
    customer_id = "".join(c for c in (customer.document or "") if c.isdigit())
    if (old_id and old_id != customer_id) or (
        not old_id
        and document.participant_name.strip().casefold()
        != customer.name.strip().casefold()
    ):
        raise FiscalError(
            "O destinatário histórico não corresponde ao cliente do pedido."
        )
    document.order_id, document.customer_id = order.id, customer.id
    document.snapshot_source = "reconciled_order"
    document.reconciled_at = now()
    # Original value/name/issue date/status and unknown original actor remain untouched.
    order_items(db, document, order)
    event(
        db,
        document,
        current.user.id,
        "legacy_order_linked",
        order_id=str(order.id),
        reason=payload.reason,
        snapshot_captured_at=document.reconciled_at.isoformat(),
    )
    return finish(db, document)
