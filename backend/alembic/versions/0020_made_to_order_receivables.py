"""Venda sob encomenda, contas a receber de pedidos e categorias padrão.

- orders.code: número sequencial do pedido por empresa (PED-000001).
- products.made_to_order: produto vendido antes de existir pronto.
- order_items.stock_deducted: guarda se o item tirou estoque de produto acabado.
- finance_entries.order_id: liga a conta a receber ao pedido de origem.
- Categoria "Confeitaria" e unidade litro no cadastro de produtos.
- Categorias financeiras padrão para empresas que ainda não têm nenhuma.

Revision ID: 0020_made_to_order_receivables
Revises: 0019_supplier_contact_fields
"""

import uuid

import sqlalchemy as sa

from alembic import op

revision = "0020_made_to_order_receivables"
down_revision = "0019_supplier_contact_fields"
branch_labels = None
depends_on = None

OLD_CATEGORIES = "category IN ('padaria', 'frios', 'bebidas', 'outros')"
NEW_CATEGORIES = "category IN ('padaria', 'confeitaria', 'frios', 'bebidas', 'outros')"
OLD_UNITS = "unit_of_measure IN ('unit', 'kg', 'g')"
NEW_UNITS = "unit_of_measure IN ('unit', 'kg', 'g', 'l')"

# Cópia congelada da lista usada pelo sistema: migrações não importam o app.
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

finance_categories = sa.table(
    "finance_categories",
    sa.column("id", sa.Uuid()),
    sa.column("organization_id", sa.Uuid()),
    sa.column("name", sa.String(120)),
    sa.column("description", sa.String(500)),
    sa.column("is_active", sa.Boolean()),
)


def default_category_rows(organization_ids):
    return [
        {
            "id": uuid.uuid4(),
            "organization_id": organization_id,
            "name": name,
            "description": description,
            "is_active": True,
        }
        for organization_id in organization_ids
        for name, description in DEFAULT_FINANCE_CATEGORIES
    ]


def organizations_without_categories(connection):
    return list(
        connection.execute(
            sa.text(
                "SELECT o.id FROM organizations o WHERE NOT EXISTS ("
                "SELECT 1 FROM finance_categories c WHERE c.organization_id = o.id)"
            )
        ).scalars()
    )


def remove_unused_default_categories(connection):
    """Remove só as categorias padrão sem nenhum lançamento; as usadas ficam."""
    for name, description in DEFAULT_FINANCE_CATEGORIES:
        connection.execute(
            sa.text(
                "DELETE FROM finance_categories WHERE name = :name "
                "AND description = :description AND NOT EXISTS ("
                "SELECT 1 FROM finance_entries e "
                "WHERE e.organization_id = finance_categories.organization_id "
                "AND e.category_id = finance_categories.id)"
            ),
            {"name": name, "description": description},
        )


def number_existing_orders(connection):
    """Numera os pedidos antigos na ordem em que foram criados, por empresa."""
    organization_ids = (
        connection.execute(sa.text("SELECT id FROM organizations ORDER BY id"))
        .scalars()
        .all()
    )
    for organization_id in organization_ids:
        order_ids = (
            connection.execute(
                sa.text(
                    "SELECT id FROM orders WHERE organization_id = :organization_id "
                    "ORDER BY created_at, id"
                ),
                {"organization_id": organization_id},
            )
            .scalars()
            .all()
        )
        for number, order_id in enumerate(order_ids, start=1):
            connection.execute(
                sa.text("UPDATE orders SET code = :code WHERE id = :order_id"),
                {"code": f"PED-{number:06d}", "order_id": order_id},
            )
        connection.execute(
            sa.text(
                "UPDATE organizations SET next_order_code = :next_code "
                "WHERE id = :organization_id"
            ),
            {"next_code": len(order_ids) + 1, "organization_id": organization_id},
        )


def upgrade():
    op.add_column(
        "organizations",
        sa.Column("next_order_code", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("orders", sa.Column("code", sa.String(20), nullable=True))
    number_existing_orders(op.get_bind())
    op.create_unique_constraint(
        "uq_orders_org_code", "orders", ["organization_id", "code"]
    )

    op.add_column(
        "products",
        sa.Column(
            "made_to_order", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    # Pedidos já existentes tiraram estoque: o padrão "true" preserva a devolução
    # correta caso eles sejam cancelados ou excluídos depois da atualização.
    op.add_column(
        "order_items",
        sa.Column(
            "stock_deducted", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )

    op.drop_constraint("ck_product_category", "products", type_="check")
    op.create_check_constraint("ck_product_category", "products", NEW_CATEGORIES)
    op.drop_constraint("ck_product_unit_of_measure", "products", type_="check")
    op.create_check_constraint("ck_product_unit_of_measure", "products", NEW_UNITS)

    op.add_column("finance_entries", sa.Column("order_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_finance_entry_order",
        "finance_entries",
        "orders",
        ["order_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_finance_entries_org_order",
        "finance_entries",
        ["organization_id", "order_id"],
    )

    rows = default_category_rows(organizations_without_categories(op.get_bind()))
    if rows:
        op.bulk_insert(finance_categories, rows)


def downgrade():
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT COUNT(*) FROM products "
            "WHERE category = 'confeitaria' OR unit_of_measure = 'l'"
        )
    ):
        raise RuntimeError(
            "Downgrade bloqueado: há produtos na categoria Confeitaria ou em litros. "
            "Altere esses produtos antes de reverter."
        )
    if connection.scalar(
        sa.text("SELECT COUNT(*) FROM order_items WHERE stock_deducted = false")
    ):
        raise RuntimeError(
            "Downgrade bloqueado: há pedidos com itens sob encomenda. A versão "
            "anterior devolveria ao estoque unidades que nunca saíram dele."
        )

    remove_unused_default_categories(connection)

    op.drop_index("ix_finance_entries_org_order", table_name="finance_entries")
    op.drop_constraint("fk_finance_entry_order", "finance_entries", type_="foreignkey")
    op.drop_column("finance_entries", "order_id")

    op.drop_constraint("ck_product_unit_of_measure", "products", type_="check")
    op.create_check_constraint("ck_product_unit_of_measure", "products", OLD_UNITS)
    op.drop_constraint("ck_product_category", "products", type_="check")
    op.create_check_constraint("ck_product_category", "products", OLD_CATEGORIES)

    op.drop_column("order_items", "stock_deducted")
    op.drop_column("products", "made_to_order")

    op.drop_constraint("uq_orders_org_code", "orders", type_="unique")
    op.drop_column("orders", "code")
    op.drop_column("organizations", "next_order_code")
