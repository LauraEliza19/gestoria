"""Adiciona condições comerciais aos orçamentos.

Revision ID: 0016_quote_commercial_terms
Revises: 0015_product_codes
"""

import sqlalchemy as sa

from alembic import op

revision = "0016_quote_commercial_terms"
down_revision = "0015_product_codes"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "quotes",
        sa.Column(
            "gross_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "quotes",
        sa.Column(
            "discount_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "quotes",
        sa.Column(
            "general_discount_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "quotes",
        sa.Column(
            "payment_terms",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'cash'"),
        ),
    )
    op.add_column(
        "quotes",
        sa.Column(
            "installment_count",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    op.add_column(
        "quote_items",
        sa.Column(
            "discount_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    op.execute(
        """
        UPDATE quotes
        SET gross_amount = total_amount,
            discount_amount = 0,
            general_discount_percent = 0,
            payment_terms = 'cash',
            installment_count = 1
        """
    )

    op.create_check_constraint(
        "ck_quote_gross_nonnegative",
        "quotes",
        "gross_amount >= 0",
    )
    op.create_check_constraint(
        "ck_quote_discount_nonnegative",
        "quotes",
        "discount_amount >= 0",
    )
    op.create_check_constraint(
        "ck_quote_general_discount_range",
        "quotes",
        "general_discount_percent >= 0 AND general_discount_percent <= 100",
    )
    op.create_check_constraint(
        "ck_quote_payment_terms",
        "quotes",
        "payment_terms IN ('cash', 'installments')",
    )
    op.create_check_constraint(
        "ck_quote_installment_count",
        "quotes",
        "("
        "payment_terms = 'cash' AND installment_count = 1"
        ") OR ("
        "payment_terms = 'installments' "
        "AND installment_count BETWEEN 2 AND 24"
        ")",
    )
    op.create_check_constraint(
        "ck_quote_item_discount_range",
        "quote_items",
        "discount_percent >= 0 AND discount_percent <= 100",
    )


def downgrade():
    op.drop_constraint(
        "ck_quote_item_discount_range",
        "quote_items",
        type_="check",
    )
    op.drop_constraint(
        "ck_quote_installment_count",
        "quotes",
        type_="check",
    )
    op.drop_constraint(
        "ck_quote_payment_terms",
        "quotes",
        type_="check",
    )
    op.drop_constraint(
        "ck_quote_general_discount_range",
        "quotes",
        type_="check",
    )
    op.drop_constraint(
        "ck_quote_discount_nonnegative",
        "quotes",
        type_="check",
    )
    op.drop_constraint(
        "ck_quote_gross_nonnegative",
        "quotes",
        type_="check",
    )

    op.drop_column("quote_items", "discount_percent")
    op.drop_column("quotes", "installment_count")
    op.drop_column("quotes", "payment_terms")
    op.drop_column("quotes", "general_discount_percent")
    op.drop_column("quotes", "discount_amount")
    op.drop_column("quotes", "gross_amount")
