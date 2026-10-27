"""merge finance and product recipe heads

Revision ID: 2bde4cefcdec
Revises: 0012_finance_module, 0012_product_recipe_link
Create Date: 2026-10-21 14:57:13.256061
"""

from collections.abc import Sequence

revision: str = "2bde4cefcdec"
down_revision: str | None = ("0012_finance_module", "0012_product_recipe_link")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
