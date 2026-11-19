"""Categorias financeiras que toda empresa recebe ao começar."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FinanceCategory, Organization

SALES_CATEGORY_NAME = "Vendas"

# A migração 0020 tem uma cópia congelada desta lista para as empresas antigas.
DEFAULT_FINANCE_CATEGORIES = (
    ("Vendas", "Recebimentos de pedidos e vendas. Criada automaticamente."),
    ("Outras receitas", "Entradas que não vêm de vendas. Criada automaticamente."),
    (
        "Compras e insumos",
        "Matéria-prima, embalagens e mercadorias. Criada automaticamente.",
    ),
    (
        "Despesas operacionais",
        "Aluguel, água, luz, internet e manutenção. Criada automaticamente.",
    ),
    ("Salários e encargos", "Folha, pró-labore e encargos. Criada automaticamente."),
    ("Impostos e taxas", "Tributos, tarifas e taxas. Criada automaticamente."),
)


def create_default_categories(db: Session, organization_id: uuid.UUID) -> int:
    """Cria as categorias padrão numa empresa que ainda não tem nenhuma.

    Não faz commit: quem chama decide junto com o restante da operação.
    """
    already_has_category = db.scalar(
        select(FinanceCategory.id)
        .where(FinanceCategory.organization_id == organization_id)
        .limit(1)
    )
    if already_has_category is not None:
        return 0
    db.add_all(
        FinanceCategory(
            organization_id=organization_id,
            name=name,
            description=description,
            is_active=True,
        )
        for name, description in DEFAULT_FINANCE_CATEGORIES
    )
    db.flush()
    return len(DEFAULT_FINANCE_CATEGORIES)


def _find_sales_category(db: Session, organization_id: uuid.UUID):
    return db.scalar(
        select(FinanceCategory)
        .where(
            FinanceCategory.organization_id == organization_id,
            func.lower(FinanceCategory.name) == SALES_CATEGORY_NAME.lower(),
        )
        .limit(1)
    )


def ensure_sales_category(db: Session, organization_id: uuid.UUID):
    """Devolve a categoria "Vendas" da empresa, criando-a se ainda não existir.

    Retorna a categoria e um dicionário com os valores gravados quando ela foi
    criada agora (para a auditoria), ou None quando já existia.
    """
    category = _find_sales_category(db, organization_id)
    if category is not None:
        return category, None

    # Trava a empresa para que dois pedidos simultâneos não criem a mesma
    # categoria ao mesmo tempo; o segundo encontra a categoria já criada.
    db.scalar(
        select(Organization.id)
        .where(Organization.id == organization_id)
        .with_for_update(key_share=True)
    )
    category = _find_sales_category(db, organization_id)
    if category is not None:
        return category, None

    description = DEFAULT_FINANCE_CATEGORIES[0][1]
    category = FinanceCategory(
        organization_id=organization_id,
        name=SALES_CATEGORY_NAME,
        description=description,
        is_active=True,
    )
    db.add(category)
    db.flush()
    return category, {
        "name": SALES_CATEGORY_NAME,
        "description": description,
        "is_active": True,
    }
