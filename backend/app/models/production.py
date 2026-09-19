"""Recipe ingredient definitions and independent branded stock."""

import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Ingredient(Base):
    __tablename__ = "production_ingredients"
    __table_args__ = (
        UniqueConstraint("organization_id", "name_key", name="uq_ingredient_name"),
        UniqueConstraint("organization_id", "id", name="uq_ingredient_tenant_id"),
        CheckConstraint(
            "unit IN ('g', 'kg', 'ml', 'L', 'un')", name="ck_ingredient_unit"
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    name_key: Mapped[str] = mapped_column(String(240), nullable=False)
    unit: Mapped[str] = mapped_column(String(2), nullable=False)


class StockItem(Base):
    __tablename__ = "production_stock_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "ingredient_id"],
            ["production_ingredients.organization_id", "production_ingredients.id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "organization_id", "name_key", name="uq_production_stock_name"
        ),
        CheckConstraint("quantity >= 0", name="ck_production_stock_quantity"),
        CheckConstraint(
            "unit IN ('g', 'kg', 'ml', 'L', 'un')", name="ck_production_stock_unit"
        ),
        Index("ix_production_stock_ingredient", "organization_id", "ingredient_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    ingredient_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    name_key: Mapped[str] = mapped_column(String(240), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(15, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(2), nullable=False)


class Recipe(Base):
    __tablename__ = "production_recipes"
    __table_args__ = (
        UniqueConstraint("organization_id", "name_key", name="uq_recipe_name"),
        UniqueConstraint("organization_id", "id", name="uq_recipe_tenant_id"),
        CheckConstraint("yield_quantity > 0", name="ck_recipe_yield"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    name_key: Mapped[str] = mapped_column(String(240), nullable=False)
    yield_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 3), nullable=False)
    yield_unit: Mapped[str] = mapped_column(String(40), nullable=False)


class RecipeIngredient(Base):
    __tablename__ = "production_recipe_ingredients"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "recipe_id"],
            ["production_recipes.organization_id", "production_recipes.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["organization_id", "ingredient_id"],
            ["production_ingredients.organization_id", "production_ingredients.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("quantity > 0", name="ck_recipe_ingredient_quantity"),
        CheckConstraint(
            "unit IN ('g', 'kg', 'ml', 'L', 'un')", name="ck_recipe_ingredient_unit"
        ),
    )
    recipe_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    ingredient_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(15, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(2), nullable=False)
