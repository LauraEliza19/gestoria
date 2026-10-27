"""Add sequential customer codes per organization.

Revision ID: 0014_customer_codes
Revises: 0013_finance_entry_versions
"""

import sqlalchemy as sa

from alembic import op

revision = "0014_customer_codes"
down_revision = "0013_finance_entry_versions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "organizations",
        sa.Column(
            "next_customer_code",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "customers",
        sa.Column("code", sa.String(20), nullable=True),
    )

    connection = op.get_bind()
    organization_ids = (
        connection.execute(sa.text("SELECT id FROM organizations ORDER BY id"))
        .scalars()
        .all()
    )

    for organization_id in organization_ids:
        customer_ids = (
            connection.execute(
                sa.text(
                    """
                SELECT id FROM customers
                WHERE organization_id = :organization_id
                ORDER BY created_at, id
                """
                ),
                {"organization_id": organization_id},
            )
            .scalars()
            .all()
        )

        for number, customer_id in enumerate(customer_ids, start=1):
            connection.execute(
                sa.text("UPDATE customers SET code = :code WHERE id = :customer_id"),
                {
                    "code": f"CLI-{number:06d}",
                    "customer_id": customer_id,
                },
            )

        connection.execute(
            sa.text(
                """
                UPDATE organizations
                SET next_customer_code = :next_code
                WHERE id = :organization_id
                """
            ),
            {
                "next_code": len(customer_ids) + 1,
                "organization_id": organization_id,
            },
        )

    op.alter_column("customers", "code", nullable=False)
    op.create_unique_constraint(
        "uq_customers_org_code",
        "customers",
        ["organization_id", "code"],
    )


def downgrade():
    op.drop_constraint("uq_customers_org_code", "customers", type_="unique")
    op.drop_column("customers", "code")
    op.drop_column("organizations", "next_customer_code")
