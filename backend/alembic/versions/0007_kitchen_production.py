"""Separate ingredient inventory and recipes.

Revision ID: 0007_kitchen_production
Revises: 0006_fiscal_integrity
"""

import sqlalchemy as sa

from alembic import op

revision = "0007_kitchen_production"
down_revision = "0006_fiscal_integrity"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "production_ingredients",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("name_key", sa.String(240), nullable=False),
        sa.Column("quantity", sa.Numeric(15, 3), nullable=False),
        sa.Column("unit", sa.String(2), nullable=False),
        sa.UniqueConstraint("organization_id", "name_key", name="uq_ingredient_name"),
        sa.UniqueConstraint("organization_id", "id", name="uq_ingredient_tenant_id"),
        sa.CheckConstraint("quantity >= 0", name="ck_ingredient_quantity"),
        sa.CheckConstraint(
            "unit IN ('g', 'kg', 'ml', 'L', 'un')", name="ck_ingredient_unit"
        ),
    )
    op.create_table(
        "production_recipes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("name_key", sa.String(240), nullable=False),
        sa.Column("yield_quantity", sa.Numeric(15, 3), nullable=False),
        sa.Column("yield_unit", sa.String(40), nullable=False),
        sa.UniqueConstraint("organization_id", "name_key", name="uq_recipe_name"),
        sa.UniqueConstraint("organization_id", "id", name="uq_recipe_tenant_id"),
        sa.CheckConstraint("yield_quantity > 0", name="ck_recipe_yield"),
    )
    op.create_table(
        "production_recipe_ingredients",
        sa.Column("recipe_id", sa.Uuid(), primary_key=True),
        sa.Column("ingredient_id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Numeric(15, 3), nullable=False),
        sa.Column("unit", sa.String(2), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id", "recipe_id"],
            ["production_recipes.organization_id", "production_recipes.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "ingredient_id"],
            ["production_ingredients.organization_id", "production_ingredients.id"],
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_recipe_ingredient_quantity"),
        sa.CheckConstraint(
            "unit IN ('g', 'kg', 'ml', 'L', 'un')", name="ck_recipe_ingredient_unit"
        ),
    )


def downgrade():
    op.drop_table("production_recipe_ingredients")
    op.drop_table("production_recipes")
    op.drop_table("production_ingredients")
