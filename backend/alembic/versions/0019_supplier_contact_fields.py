"""Telefone e e-mail no cadastro de fornecedores.

Revision ID: 0019_supplier_contact_fields
Revises: 0018_order_delivery_planning
"""

import sqlalchemy as sa

from alembic import op

revision = "0019_supplier_contact_fields"
down_revision = "0018_order_delivery_planning"
branch_labels = None
depends_on = None


def upgrade():
    # Colunas opcionais: fornecedores já cadastrados permanecem válidos.
    op.add_column("suppliers", sa.Column("phone", sa.String(length=30), nullable=True))
    op.add_column("suppliers", sa.Column("email", sa.String(length=255), nullable=True))


def downgrade():
    # A reversão descarta apenas os contatos; nome, documento e notas permanecem.
    op.drop_column("suppliers", "email")
    op.drop_column("suppliers", "phone")
