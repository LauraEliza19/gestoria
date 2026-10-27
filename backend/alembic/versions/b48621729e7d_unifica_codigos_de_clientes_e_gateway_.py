"""Unifica códigos de clientes e gateway seguro do Copiloto.

Revision ID: b48621729e7d
Revises: 0014_customer_codes, 0014_copilot_security_gateway
Create Date: 2026-10-27 08:28:17.300629
"""

from collections.abc import Sequence

revision: str = "b48621729e7d"
down_revision: tuple[str, str] = (
    "0014_customer_codes",
    "0014_copilot_security_gateway",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
