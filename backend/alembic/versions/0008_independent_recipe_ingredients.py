"""Keep recipe ingredients independent from branded stock items.

Revision ID: 0008_recipe_ingredients
Revises: 0007_kitchen_production
"""

import sqlalchemy as sa

from alembic import op

revision = "0008_recipe_ingredients"
down_revision = "0007_kitchen_production"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "production_stock_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("ingredient_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("name_key", sa.String(240), nullable=False),
        sa.Column("quantity", sa.Numeric(15, 3), nullable=False),
        sa.Column("unit", sa.String(2), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id", "ingredient_id"],
            ["production_ingredients.organization_id", "production_ingredients.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "organization_id", "name_key", name="uq_production_stock_name"
        ),
        sa.CheckConstraint("quantity >= 0", name="ck_production_stock_quantity"),
        sa.CheckConstraint(
            "unit IN ('g', 'kg', 'ml', 'L', 'un')", name="ck_production_stock_unit"
        ),
    )
    op.create_index(
        "ix_production_stock_ingredient",
        "production_stock_items",
        ["organization_id", "ingredient_id"],
    )
    # Preserve every existing balance, name, unit and association, including zeros.
    op.execute(
        sa.text("""
        INSERT INTO production_stock_items
            (id, organization_id, ingredient_id, name, name_key, quantity, unit)
        SELECT id, organization_id, id, name, name_key, quantity, unit
        FROM production_ingredients
    """)
    )
    op.drop_constraint(
        "ck_ingredient_quantity", "production_ingredients", type_="check"
    )
    op.drop_column("production_ingredients", "quantity")


def downgrade():
    # The old schema cannot represent independent recipes and multiple brands.
    # Never silently flatten or discard those records.
    conn = op.get_bind()
    if conn.scalar(sa.text("SELECT COUNT(*) FROM production_ingredients")):
        raise RuntimeError(
            "Production downgrade blocked: ingredient data exists. Restore a reviewed backup."
        )
    op.add_column(
        "production_ingredients",
        sa.Column("quantity", sa.Numeric(15, 3), nullable=False),
    )
    op.create_check_constraint(
        "ck_ingredient_quantity", "production_ingredients", "quantity >= 0"
    )
    op.drop_table("production_stock_items")
