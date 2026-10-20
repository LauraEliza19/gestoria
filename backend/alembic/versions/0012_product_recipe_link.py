"""Link sold products to production recipes by id.

Revision ID: 0012_product_recipe_link
Revises: 0011_employee_records
"""

import sqlalchemy as sa

from alembic import op

revision = "0012_product_recipe_link"
down_revision = "0011_employee_records"
branch_labels = None
depends_on = None


def upgrade():
    # Existing products start unlinked. Names are never used to guess a recipe.
    op.add_column("products", sa.Column("recipe_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_product_recipe",
        "products",
        "production_recipes",
        ["organization_id", "recipe_id"],
        ["organization_id", "id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_products_org_recipe",
        "products",
        ["organization_id", "recipe_id"],
    )


def downgrade():
    conn = op.get_bind()
    if conn.scalar(
        sa.text("SELECT COUNT(*) FROM products WHERE recipe_id IS NOT NULL")
    ):
        raise RuntimeError(
            "Product recipe downgrade blocked: linked products exist. "
            "Unlink them or restore a reviewed backup."
        )
    op.drop_index("ix_products_org_recipe", table_name="products")
    op.drop_constraint("fk_product_recipe", "products", type_="foreignkey")
    op.drop_column("products", "recipe_id")
