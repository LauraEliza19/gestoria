"""Carga idempotente de dados para demonstrações do GestorIA."""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import (
    Customer,
    Order,
    OrderItem,
    Organization,
    OrganizationMember,
    Product,
    Quote,
    QuoteItem,
    User,
)
from app.models.production import (
    Ingredient,
    Recipe,
    RecipeIngredient,
    StockItem,
)
from app.security import hash_password
from app.services.production import normalize_name

DEMO_NAMESPACE = uuid.UUID(
    "860c7ee5-51ec-4e14-a535-2168cd352966"
)

PITCH_ORGANIZATION_NAME = "Padaria Aurora"
PITCH_ORGANIZATION_SLUG = "padaria-aurora-pitch"
PITCH_EMAIL = "pitch@gestoria.dev"
PITCH_DATASET_SCOPE = "pitch:padaria-aurora:v1"


def stable_id(name: str) -> uuid.UUID:
    """Gera um UUID estável e exclusivo para os dados do pitch."""
    scoped_name = f"{PITCH_DATASET_SCOPE}:{name}"
    return uuid.uuid5(DEMO_NAMESPACE, scoped_name)


def money(value: str) -> Decimal:
    return Decimal(value)


def pitch_organization(db: Session) -> Organization:
    organization = db.scalar(
        select(Organization).where(
            Organization.slug == PITCH_ORGANIZATION_SLUG,
        )
    )

    if organization is None:
        organization = Organization(
            id=stable_id("organization:pitch"),
            name=PITCH_ORGANIZATION_NAME,
            slug=PITCH_ORGANIZATION_SLUG,
        )
        db.add(organization)
    else:
        organization.name = PITCH_ORGANIZATION_NAME

    db.flush()
    return organization


def pitch_user(
    db: Session,
    organization: Organization,
) -> User:
    user = db.scalar(
        select(User).where(
            User.email == PITCH_EMAIL,
        )
    )

    if user is None:
        user = User(
            id=stable_id("user:pitch"),
            full_name="Marina Silva",
            email=PITCH_EMAIL,
            password_hash=hash_password(
                settings.demo_password,
            ),
            is_active=True,
        )
        db.add(user)
    else:
        user.full_name = "Marina Silva"
        user.password_hash = hash_password(
            settings.demo_password,
        )
        user.is_active = True

    db.flush()

    membership = db.get(
        OrganizationMember,
        (organization.id, user.id),
    )

    if membership is None:
        membership = OrganizationMember(
            organization_id=organization.id,
            user_id=user.id,
            role="owner",
            is_active=True,
        )
        db.add(membership)
    else:
        membership.role = "owner"
        membership.is_active = True

    db.flush()
    return user


def seed_pitch_demo(db: Session) -> None:
    organization = pitch_organization(db)
    user = pitch_user(db, organization)

    organization.name = "Padaria Aurora"
    organization.document = "12345678000199"
    organization.state_registration = "001234567"
    organization.municipal_registration = "45872"
    organization.phone = "3534231000"
    organization.postal_code = "37550000"
    organization.street = "Avenida Central"
    organization.number = "450"
    organization.neighborhood = "Centro"
    organization.city = "Pouso Alegre"
    organization.state = "MG"

    customers = seed_customers(db, organization.id)
    products = seed_products(db, organization.id)

    orders = seed_orders(
    db,
    organization.id,
    customers,
    products,
    )
    quotes = seed_quotes(
    db,
    organization.id,
    customers,
    products,
    )

    ingredients, stock_items, recipes = seed_production(
    db,
    organization.id,
    )

    db.commit()

    print(
        f"Empresa: {organization.name} | "
        f"Usuário: {user.email} | "
        f"Clientes: {len(customers)} | "
        f"Produtos: {len(products)} | "
        f"Pedidos: {len(orders)} | "
        f"Orçamentos: {len(quotes)}"
        f" | Ingredientes: {len(ingredients)}"
        f" | Estoque da fábrica: {len(stock_items)}"
        f" | Receitas: {len(recipes)}"
    )


def main() -> None:
    with SessionLocal() as db:
        seed_pitch_demo(db)

    print("Dados do pitch preparados com sucesso.")


def upsert_record(
    db: Session,
    model,
    key: str,
    **values,
):
    record_id = stable_id(key)
    record = db.get(model, record_id)

    if record is None:
        record = model(id=record_id, **values)
        db.add(record)
    else:
        for field, value in values.items():
            setattr(record, field, value)

    return record


def seed_customers(
    db: Session,
    organization_id: uuid.UUID,
) -> dict[str, Customer]:
    customer_data = {
        "mariana": {
            "name": "Mariana Oliveira",
            "phone": "35999991001",
            "whatsapp": "35999991001",
            "email": "mariana.oliveira@example.com",
            "person_type": "individual",
            "document": "12345678901",
            "category": "final_consumer",
            "default_discount_percent": money("0"),
            "notes": (
                "Cliente recorrente. Prefere contato pelo WhatsApp "
                "e costuma comprar kits para a família."
            ),
            "postal_code": "37550001",
            "street": "Rua das Acácias",
            "number": "125",
            "neighborhood": "Centro",
            "city": "Pouso Alegre",
            "state": "MG",
            "is_active": True,
        },
        "emporio": {
            "name": "Empório Serra Verde Ltda",
            "phone": "3534232001",
            "whatsapp": "3534232001",
            "email": "compras@emporioserraverde.com.br",
            "person_type": "company",
            "document": "12345678000190",
            "trade_name": "Empório Serra Verde",
            "state_registration": "001234567",
            "category": "reseller",
            "default_discount_percent": money("8"),
            "notes": (
                "Revendedor regional. Reativar relacionamento "
                "com uma condição comercial personalizada."
            ),
            "postal_code": "37550002",
            "street": "Avenida das Montanhas",
            "number": "820",
            "neighborhood": "Industrial",
            "city": "Pouso Alegre",
            "state": "MG",
            "is_active": True,
        },
        "eventos": {
            "name": "Eventos Horizonte",
            "phone": "35999991003",
            "whatsapp": "35999991003",
            "email": "contato@eventoshorizonte.com.br",
            "person_type": "company",
            "document": "98765432000110",
            "trade_name": "Eventos Horizonte",
            "state_registration": "Isento",
            "category": "event",
            "default_discount_percent": money("5"),
            "notes": (
                "Lead interessado em coffee breaks corporativos. "
                "Orçamento aguardando retorno."
            ),
            "postal_code": "37550003",
            "street": "Rua do Comércio",
            "number": "310",
            "neighborhood": "São Geraldo",
            "city": "Pouso Alegre",
            "state": "MG",
            "is_active": True,
        },
        "carlos": {
            "name": "Carlos Mendes",
            "phone": "35999991004",
            "whatsapp": "35999991004",
            "email": "carlos.mendes@example.com",
            "person_type": "individual",
            "document": "98765432100",
            "category": "final_consumer",
            "default_discount_percent": money("0"),
            "notes": (
                "Novo cliente cadastrado durante campanha local."
            ),
            "postal_code": "37550004",
            "street": "Rua das Flores",
            "number": "48",
            "neighborhood": "Jardim América",
            "city": "Pouso Alegre",
            "state": "MG",
            "is_active": True,
        },
    }

    customers = {}

    for key, values in customer_data.items():
        customers[key] = upsert_record(
            db,
            Customer,
            f"customer:{key}",
            organization_id=organization_id,
            **values,
        )

    db.flush()
    return customers


def seed_products(
    db: Session,
    organization_id: uuid.UUID,
) -> dict[str, Product]:
    product_data = {
        "pao_queijo": {
            "name": "Pão de queijo artesanal",
            "description": (
                "Pão de queijo mineiro produzido diariamente."
            ),
            "price": money("8.50"),
            "cost_price": money("3.10"),
            "stock_quantity": money("4"),
            "min_stock_quantity": money("12"),
            "category": "padaria",
            "product_type": "manufactured",
            "unit_of_measure": "unit",
            "perishable": True,
            "shelf_life_days": 2,
            "barcode": "7891000001001",
            "ncm_code": "19059090",
            "cest_code": "1706200",
            "fiscal_origin": 0,
            "is_active": True,
        },
        "bolo_chocolate": {
            "name": "Bolo de chocolate premium",
            "description": (
                "Bolo artesanal com cobertura de chocolate."
            ),
            "price": money("45.00"),
            "cost_price": money("18.00"),
            "stock_quantity": money("16"),
            "min_stock_quantity": money("5"),
            "category": "padaria",
            "product_type": "manufactured",
            "unit_of_measure": "unit",
            "perishable": True,
            "shelf_life_days": 4,
            "barcode": "7891000001002",
            "ncm_code": "19059090",
            "cest_code": "1706200",
            "fiscal_origin": 0,
            "is_active": True,
        },
        "cafe_especial": {
            "name": "Café especial 500 g",
            "description": (
                "Café torrado e moído de origem controlada."
            ),
            "price": money("28.90"),
            "cost_price": money("17.50"),
            "stock_quantity": money("2"),
            "min_stock_quantity": money("8"),
            "category": "bebidas",
            "product_type": "resale",
            "unit_of_measure": "unit",
            "perishable": False,
            "shelf_life_days": None,
            "barcode": "7891000001003",
            "ncm_code": "09012100",
            "cest_code": "1709600",
            "fiscal_origin": 0,
            "is_active": True,
        },
        "kit_corporativo": {
            "name": "Kit coffee break corporativo",
            "description": (
                "Seleção completa para reuniões e eventos."
            ),
            "price": money("129.90"),
            "cost_price": money("62.00"),
            "stock_quantity": money("12"),
            "min_stock_quantity": money("3"),
            "category": "outros",
            "product_type": "manufactured",
            "unit_of_measure": "unit",
            "perishable": True,
            "shelf_life_days": 2,
            "barcode": "7891000001004",
            "ncm_code": "21069090",
            "cest_code": "1708900",
            "fiscal_origin": 0,
            "is_active": True,
        },
        "suco_natural": {
            "name": "Suco natural de laranja",
            "description": (
                "Garrafa de 500 ml preparada no dia."
            ),
            "price": money("12.00"),
            "cost_price": money("5.20"),
            "stock_quantity": money("0"),
            "min_stock_quantity": money("6"),
            "category": "bebidas",
            "product_type": "manufactured",
            "unit_of_measure": "unit",
            "perishable": True,
            "shelf_life_days": 1,
            "barcode": "7891000001005",
            "ncm_code": "20091200",
            "cest_code": "0300700",
            "fiscal_origin": 0,
            "is_active": True,
        },
    }

    products = {}

    for key, values in product_data.items():
        products[key] = upsert_record(
            db,
            Product,
            f"product:{key}",
            organization_id=organization_id,
            **values,
        )

    db.flush()
    return products

def seed_order(
    db: Session,
    key: str,
    organization_id: uuid.UUID,
    customer: Customer,
    status: str,
    created_at: datetime,
    items: list[tuple[Product, Decimal]],
) -> Order:
    total = sum(
        (
            product.price * quantity
            for product, quantity in items
        ),
        start=money("0"),
    )

    order = upsert_record(
        db,
        Order,
        f"order:{key}",
        organization_id=organization_id,
        customer_id=customer.id,
        status=status,
        total_amount=total,
        created_at=created_at,
    )

    db.flush()

    for index, (product, quantity) in enumerate(items):
        upsert_record(
            db,
            OrderItem,
            f"order-item:{key}:{index}",
            order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=product.price,
            created_at=created_at,
        )

    return order


def seed_orders(
    db: Session,
    organization_id: uuid.UUID,
    customers: dict[str, Customer],
    products: dict[str, Product],
) -> dict[str, Order]:
    now = datetime.now(timezone.utc)

    orders = {
        "venda_hoje": seed_order(
            db,
            "venda_hoje",
            organization_id,
            customers["mariana"],
            "completed",
            now - timedelta(hours=2),
            [
                (
                    products["bolo_chocolate"],
                    money("2"),
                ),
                (
                    products["cafe_especial"],
                    money("3"),
                ),
            ],
        ),
        "em_producao": seed_order(
            db,
            "em_producao",
            organization_id,
            customers["eventos"],
            "in_preparation",
            now - timedelta(hours=1),
            [
                (
                    products["kit_corporativo"],
                    money("3"),
                ),
            ],
        ),
        "cliente_inativo": seed_order(
            db,
            "cliente_inativo",
            organization_id,
            customers["emporio"],
            "completed",
            now - timedelta(days=75),
            [
                (
                    products["cafe_especial"],
                    money("10"),
                ),
            ],
        ),
    }

    db.flush()
    return orders


def seed_quote(
    db: Session,
    key: str,
    organization_id: uuid.UUID,
    customer: Customer,
    status: str,
    valid_until: date,
    created_at: datetime,
    items: list[tuple[Product, Decimal]],
) -> Quote:
    total = sum(
        (
            product.price * quantity
            for product, quantity in items
        ),
        start=money("0"),
    )

    quote = upsert_record(
        db,
        Quote,
        f"quote:{key}",
        organization_id=organization_id,
        customer_id=customer.id,
        status=status,
        valid_until=valid_until,
        total_amount=total,
        converted_order_id=None,
        created_at=created_at,
    )

    db.flush()

    for index, (product, quantity) in enumerate(items):
        upsert_record(
            db,
            QuoteItem,
            f"quote-item:{key}:{index}",
            quote_id=quote.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=product.price,
            created_at=created_at,
        )

    return quote


def seed_quotes(
    db: Session,
    organization_id: uuid.UUID,
    customers: dict[str, Customer],
    products: dict[str, Product],
) -> dict[str, Quote]:
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)

    quotes = {
        "vence_em_breve": seed_quote(
            db,
            "vence_em_breve",
            organization_id,
            customers["eventos"],
            "pending",
            today + timedelta(days=3),
            now - timedelta(days=1),
            [
                (
                    products["kit_corporativo"],
                    money("2"),
                ),
            ],
        ),
        "vencido": seed_quote(
            db,
            "vencido",
            organization_id,
            customers["emporio"],
            "pending",
            today - timedelta(days=2),
            now - timedelta(days=10),
            [
                (
                    products["cafe_especial"],
                    money("5"),
                ),
            ],
        ),
        "aprovado": seed_quote(
            db,
            "aprovado",
            organization_id,
            customers["mariana"],
            "approved",
            today + timedelta(days=10),
            now - timedelta(hours=6),
            [
                (
                    products["bolo_chocolate"],
                    money("2"),
                ),
            ],
        ),
    }

    db.flush()
    return quotes

def seed_ingredients(
    db: Session,
    organization_id: uuid.UUID,
) -> dict[str, Ingredient]:
    ingredient_data = {
        "farinha": ("Farinha de trigo", "g"),
        "acucar": ("Açúcar", "g"),
        "ovos": ("Ovos", "un"),
        "leite": ("Leite", "ml"),
        "chocolate": ("Chocolate", "g"),
        "polvilho": ("Polvilho azedo", "g"),
        "queijo": ("Queijo meia cura", "g"),
        "cafe": ("Café moído", "g"),
        "agua": ("Água filtrada", "ml"),
    }

    ingredients = {}

    for key, (name, unit) in ingredient_data.items():
        ingredients[key] = upsert_record(
            db,
            Ingredient,
            f"ingredient:{key}",
            organization_id=organization_id,
            name=name,
            name_key=normalize_name(name),
            unit=unit,
        )

    db.flush()
    return ingredients


def seed_stock_items(
    db: Session,
    organization_id: uuid.UUID,
    ingredients: dict[str, Ingredient],
) -> dict[str, StockItem]:
    stock_data = {
        "farinha_premium": {
            "name": "Farinha Premium 5 kg",
            "ingredient": "farinha",
            "quantity": money("12"),
            "unit": "kg",
        },
        "acucar_cristal": {
            "name": "Açúcar Cristal",
            "ingredient": "acucar",
            "quantity": money("5"),
            "unit": "kg",
        },
        "ovos_brancos": {
            "name": "Ovos brancos",
            "ingredient": "ovos",
            "quantity": money("60"),
            "unit": "un",
        },
        "leite_integral": {
            "name": "Leite integral",
            "ingredient": "leite",
            "quantity": money("8"),
            "unit": "L",
        },
        "chocolate_cobertura": {
            "name": "Chocolate para cobertura",
            "ingredient": "chocolate",
            "quantity": money("2"),
            "unit": "kg",
        },
        "cafe_especial": {
            "name": "Café especial em grãos",
            "ingredient": "cafe",
            "quantity": money("2"),
            "unit": "kg",
        },
        "agua_filtrada": {
            "name": "Água filtrada",
            "ingredient": "agua",
            "quantity": money("40"),
            "unit": "L",
        },
        "polvilho_sem_saldo": {
            "name": "Polvilho azedo",
            "ingredient": "polvilho",
            "quantity": money("0"),
            "unit": "kg",
        },
    }

    stock_items = {}

    for key, values in stock_data.items():
        ingredient = ingredients[values["ingredient"]]
        name = values["name"]

        stock_items[key] = upsert_record(
            db,
            StockItem,
            f"stock-item:{key}",
            organization_id=organization_id,
            ingredient_id=ingredient.id,
            name=name,
            name_key=normalize_name(name),
            quantity=values["quantity"],
            unit=values["unit"],
        )

    db.flush()
    return stock_items


def seed_recipe(
    db: Session,
    key: str,
    organization_id: uuid.UUID,
    name: str,
    yield_quantity: Decimal,
    yield_unit: str,
    ingredients: dict[str, Ingredient],
    items: list[tuple[str, Decimal, str]],
) -> Recipe:
    recipe = upsert_record(
        db,
        Recipe,
        f"recipe:{key}",
        organization_id=organization_id,
        name=name,
        name_key=normalize_name(name),
        yield_quantity=yield_quantity,
        yield_unit=yield_unit,
    )

    db.flush()

    expected_ingredients = set()

    for ingredient_key, quantity, unit in items:
        ingredient = ingredients[ingredient_key]
        expected_ingredients.add(ingredient.id)

        recipe_item = db.get(
            RecipeIngredient,
            (recipe.id, ingredient.id),
        )

        if recipe_item is None:
            recipe_item = RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                organization_id=organization_id,
                quantity=quantity,
                unit=unit,
            )
            db.add(recipe_item)
        else:
            recipe_item.organization_id = organization_id
            recipe_item.quantity = quantity
            recipe_item.unit = unit

    existing_items = list(
        db.scalars(
            select(RecipeIngredient).where(
                RecipeIngredient.organization_id
                == organization_id,
                RecipeIngredient.recipe_id == recipe.id,
            )
        )
    )

    for item in existing_items:
        if item.ingredient_id not in expected_ingredients:
            db.delete(item)

    return recipe


def seed_production(
    db: Session,
    organization_id: uuid.UUID,
) -> tuple[
    dict[str, Ingredient],
    dict[str, StockItem],
    dict[str, Recipe],
]:
    ingredients = seed_ingredients(
        db,
        organization_id,
    )
    stock_items = seed_stock_items(
        db,
        organization_id,
        ingredients,
    )

    recipes = {
        "bolo_chocolate": seed_recipe(
            db,
            "bolo_chocolate",
            organization_id,
            "Bolo de chocolate premium",
            money("12"),
            "fatias",
            ingredients,
            [
                ("farinha", money("500"), "g"),
                ("acucar", money("300"), "g"),
                ("ovos", money("4"), "un"),
                ("leite", money("250"), "ml"),
                ("chocolate", money("200"), "g"),
            ],
        ),
        "pao_queijo": seed_recipe(
            db,
            "pao_queijo",
            organization_id,
            "Pão de queijo artesanal",
            money("30"),
            "unidades",
            ingredients,
            [
                ("polvilho", money("500"), "g"),
                ("queijo", money("300"), "g"),
                ("leite", money("200"), "ml"),
                ("ovos", money("2"), "un"),
            ],
        ),
        "cafe_coado": seed_recipe(
            db,
            "cafe_coado",
            organization_id,
            "Café coado para eventos",
            money("1"),
            "litro",
            ingredients,
            [
                ("cafe", money("50"), "g"),
                ("agua", money("1000"), "ml"),
            ],
        ),
    }

    db.flush()
    return ingredients, stock_items, recipes

if __name__ == "__main__":
    main()
