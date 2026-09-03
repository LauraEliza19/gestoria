"""add product catalog fields fractional quantities

Revision ID: e8559033a8ca
Revises: 20796917ffea
Create Date: 2026-09-03 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa 


revision: str = 'e8559033a8ca'
down_revision: Union[str, None] = '20796917ffea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    #Products: campos de catálogo, estoque, perecibilidade e fiscal
    op.add_column('products', sa.Column('category', sa.String(length=20), nullable=False, server_default='outros'))
    op.add_column('products', sa.Column('product_type', sa.String(length=20), nullable=False, server_default='resale'))
    op.add_column('products', sa.Column('unit_of_measure', sa.String(length=10), nullable=False, server_default='unit'))
    op.add_column('products', sa.Column('cost_price', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('products', sa.Column('min_stock_quantity', sa.Numeric(precision=10, scale=3), nullable=False, server_default='5'))
    op.add_column('products', sa.Column('perishable', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('products', sa.Column('shelf_life_days', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('barcode', sa.String(length=50), nullable=True))
    op.add_column('products', sa.Column('ncm_code', sa.String(length=8), nullable=True))
    op.add_column('products', sa.Column('cest_code', sa.String(length=7), nullable=True))
    op.add_column('products', sa.Column('fiscal_origin', sa.SmallInteger(), nullable=True))
    op.create_check_constraint(
        'ck_product_cost_price_nonnegative', 'products', 'cost_price IS NULL OR cost_price >= 0'
    )
    op.create_check_constraint(
        'ck_product_min_stock_nonnegative', 'products', 'min_stock_quantity >= 0'
    )
    op.create_check_constraint(
        'ck_product_category', 'products', "category IN ('padaria', 'frios', 'bebidas', 'outros')"
    )
    op.create_check_constraint(
        'ck_product_type', 'products', "product_type IN ('manufactured', 'resale')"
    )
    op.create_check_constraint(
        'ck_product_unit_of_measure', 'products', "unit_of_measure IN ('unit', 'kg', 'g')"
    )
    op.create_check_constraint(
        'ck_product_shelf_life_positive', 'products', 'shelf_life_days IS NULL OR shelf_life_days > 0'
    )
    op.create_check_constraint(
        'ck_product_perishable_requires_shelf_life',
        'products',
        'NOT perishable OR shelf_life_days IS NOT NULL',
    )
    op.create_check_constraint(
        'ck_product_fiscal_origin_range',
        'products',
        'fiscal_origin IS NULL OR (fiscal_origin >= 0 AND fiscal_origin <= 8)',
    )
    op.create_index('ix_products_org_category', 'products', ['organization_id', 'category'])

      #Estoque e quantidades passam a suportar frações (kg/g)
    op.alter_column(
        'products',
        'stock_quantity',
        type_=sa.Numeric(precision=10, scale=3),
        existing_type=sa.Integer(),
        existing_nullable=False,
        postgresql_using='stock_quantity::numeric(10,3)',
    )
    op.alter_column(
        'order_items',
        'quantity',
        type_=sa.Numeric(precision=10, scale=3),
        existing_type=sa.Integer(),
        existing_nullable=False,
        postgresql_using='quantity::numeric(10,3)',
    )
    op.alter_column(
        'quote_items',
        'quantity',
        type_=sa.Numeric(precision=10, scale=3),
        existing_type=sa.Integer(),
        existing_nullable=False,
        postgresql_using='quantity::numeric(10,3)',
    )

def downgrade() -> None:
    op.alter_column(
        'quote_items',
        'quantity',
        type_=sa.Integer(),
        existing_type=sa.Numeric(precision=10, scale=3),
        existing_nullable=False,
        postgresql_using='round(quantity)::integer',
    )
    op.alter_column(
        'order_items',
        'quantity',
        type_=sa.Integer(),
        existing_type=sa.Numeric(precision=10, scale=3),
        existing_nullable=False,
        postgresql_using='round(quantity)::integer',
    )
    op.alter_column(
        'products',
        'stock_quantity',
        type_=sa.Integer(),
        existing_type=sa.Numeric(precision=10, scale=3),
        existing_nullable=False,
        postgresql_using='round(stock_quantity)::integer',
    )

    op.drop_index('ix_products_org_category', table_name='products')
    op.drop_constraint('ck_product_fiscal_origin_range', 'products', type_='check')
    op.drop_constraint('ck_product_perishable_requires_shelf_life', 'products', type_='check')
    op.drop_constraint('ck_product_shelf_life_positive', 'products', type_='check')
    op.drop_constraint('ck_product_unit_of_measure', 'products', type_='check')
    op.drop_constraint('ck_product_type', 'products', type_='check')
    op.drop_constraint('ck_product_category', 'products', type_='check')
    op.drop_constraint('ck_product_min_stock_nonnegative', 'products', type_='check')
    op.drop_constraint('ck_product_cost_price_nonnegative', 'products', type_='check')

    op.drop_column('products', 'fiscal_origin')
    op.drop_column('products', 'cest_code')
    op.drop_column('products', 'ncm_code')
    op.drop_column('products', 'barcode')
    op.drop_column('products', 'shelf_life_days')
    op.drop_column('products', 'perishable')
    op.drop_column('products', 'min_stock_quantity')
    op.drop_column('products', 'cost_price')
    op.drop_column('products', 'unit_of_measure')
    op.drop_column('products', 'product_type')
    op.drop_column('products', 'category')