import uuid
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Unit = Literal["g", "kg", "ml", "L", "un"]
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]
Quantity = Annotated[
    Decimal, Field(ge=0, le=1_000_000_000, max_digits=13, decimal_places=3)
]
PositiveQuantity = Annotated[
    Decimal, Field(gt=0, le=1_000_000, max_digits=10, decimal_places=3)
]


class ProductionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IngredientSelection(ProductionInput):
    ingredient_id: uuid.UUID | None = None
    ingredient_name: Name | None = None

    @model_validator(mode="after")
    def explicit_ingredient(self):
        if (self.ingredient_id is None) == (self.ingredient_name is None):
            raise ValueError(
                "Selecione um ingrediente existente ou informe o nome de um novo ingrediente."
            )
        return self


class StockItemInput(IngredientSelection):
    name: Name
    quantity: Quantity
    unit: Unit


class IngredientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    unit: Unit


class StockItemRead(BaseModel):
    id: uuid.UUID
    name: str
    quantity: Decimal
    unit: Unit
    ingredient_id: uuid.UUID
    ingredient_name: str


class RecipeItemInput(IngredientSelection):
    quantity: PositiveQuantity
    unit: Unit


class RecipeInput(ProductionInput):
    name: Name
    yield_quantity: PositiveQuantity
    yield_unit: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)
    ]
    items: list[RecipeItemInput] = Field(min_length=1, max_length=100)


class RecipeItemRead(BaseModel):
    ingredient_id: uuid.UUID
    ingredient_name: str
    quantity: Decimal
    unit: Unit
    available_quantity: Decimal
    missing_quantity: Decimal


class RecipeRead(BaseModel):
    id: uuid.UUID
    name: str
    yield_quantity: Decimal
    yield_unit: str
    items: list[RecipeItemRead]
    max_batches: int
    possible_yield: Decimal


class ProductionRead(BaseModel):
    ingredients: list[IngredientRead]
    stock_items: list[StockItemRead]
    recipes: list[RecipeRead]
