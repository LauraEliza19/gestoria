"""Adiciona códigos sequenciais de produtos por empresa.

Revision ID: 0015_product_codes
Revises: b48621729e7d
"""

import sqlalchemy as sa

from alembic import op

revision = "0015_product_codes"
down_revision = "b48621729e7d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "organizations",
        sa.Column(
            "next_product_code",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )

    op.add_column(
        "products",
        sa.Column("code", sa.String(20), nullable=True),
    )

    connection = op.get_bind()

    organization_ids = (
        connection.execute(sa.text("SELECT id FROM organizations ORDER BY id"))
        .scalars()
        .all()
    )

    for organization_id in organization_ids:
        product_ids = (
            connection.execute(
                sa.text(
                    """
                    SELECT id
                    FROM products
                    WHERE organization_id = :organization_id
                    ORDER BY created_at, id
                    """
                ),
                {"organization_id": organization_id},
            )
            .scalars()
            .all()
        )

        for number, product_id in enumerate(product_ids, start=1):
            connection.execute(
                sa.text("UPDATE products SET code = :code WHERE id = :product_id"),
                {
                    "code": f"PRO-{number:06d}",
                    "product_id": product_id,
                },
            )

        connection.execute(
            sa.text(
                """
                UPDATE organizations
                SET next_product_code = :next_code
                WHERE id = :organization_id
                """
            ),
            {
                "next_code": len(product_ids) + 1,
                "organization_id": organization_id,
            },
        )

    op.alter_column("products", "code", nullable=False)

    op.create_unique_constraint(
        "uq_products_org_code",
        "products",
        ["organization_id", "code"],
    )


def downgrade():
    op.drop_constraint(
        "uq_products_org_code",
        "products",
        type_="unique",
    )
    op.drop_column("products", "code")
    op.drop_column("organizations", "next_product_code")
