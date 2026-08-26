# 📦 GestorIA — Módulo de Clientes e Pedidos

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.1.0-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.x-D71F00)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)

Documentação técnica da extensão do backend do **GestorIA**, adicionando as entidades **Cliente**, **Pedido** e **Item de Pedido** ao sistema já existente (autenticação + Produtos), seguindo a arquitetura em camadas do projeto:

```
model → migration → schema → repository → service → rota → frontend
```

---

## 📑 Sumário

- [Ponto de partida](#-ponto-de-partida)
- [Regras de negócio](#-regras-de-negócio)
- [O que foi implementado](#-o-que-foi-implementado)
  - [Models](#31-models-appmodelspy)
  - [Migration](#32-migration-alembic)
  - [Schemas](#33-schemas-appschemaspy)
  - [Repositories](#34-repositories-apprepositoriespy)
  - [Service](#35-service-appservicespy--a-parte-mais-importante)
  - [Rotas da API](#36-rotas-da-api)
- [Testes realizados](#-testes-realizados-via-swagger--docs)
- [Bugs encontrados e corrigidos](#-bugs-encontrados-e-corrigidos-durante-a-implementação)
- [Roadmap / próximos passos](#-roadmap--próximos-passos)

---

## 🔹 Ponto de partida

Antes desta implementação, o backend já contava com:

- ✅ Autenticação (login com JWT, hash de senha com Argon2)
- ✅ Isolamento multi-tenant via `organization_id` em toda tabela de negócio
- ✅ CRUD completo de **Produtos**, com status derivado (`Disponível` / `Estoque baixo` / `Esgotado`)
- ✅ Papéis de usuário (`owner`, `admin`, `member`) via tabela `organization_members`

O frontend (`dashboard.html`) já tinha o protótipo visual completo de todas as telas, mas só **Produtos** estava de fato conectado à API.

---

## 🔹 Regras de negócio

| Regra | Decisão |
|---|---|
| **Estoque ao criar Pedido** | Desconta automaticamente; **bloqueia** a criação se não houver estoque suficiente |
| **Excluir Cliente com Pedidos vinculados** | O banco de dados recusa a exclusão (`ON DELETE RESTRICT`) |
| **Quem pode excluir registros** | Apenas `owner` e `admin` — implementado em Pedidos; **pendente** em Clientes/Produtos |
| **Pedido com múltiplos produtos** | Sim, por consistência com Orçamentos (que já suportam múltiplos itens) |
| **Transição de status do Pedido** | Livre entre `in_preparation` / `completed` / `cancelled`, sem regra de fluxo travada |
| **"Total gasto" do cliente** | Ainda não implementado — deve somar apenas Pedidos `completed` |

---

## 🔹 O que foi implementado

### 3.1 Models (`app/models.py`)

<details>
<summary><strong>Customer</strong> — tabela <code>customers</code></summary>

- `id`, `organization_id`, `name`, `phone`, `is_active`, `created_at`, `updated_at`
- Constraint: telefone único por empresa (`uq_customer_org_phone`)
</details>

<details>
<summary><strong>Order</strong> — tabela <code>orders</code> (cabeçalho do pedido)</summary>

- `id`, `organization_id`, `customer_id`, `status`, `total_amount`, `created_at`, `updated_at`
- `CheckConstraint`: `status` só aceita `in_preparation`, `completed` ou `cancelled`
- `ForeignKey("customers.id", ondelete="RESTRICT")` → implementa a regra de não deixar excluir cliente com pedido vinculado, na camada mais segura possível
</details>

<details>
<summary><strong>OrderItem</strong> — tabela <code>order_items</code> (produtos dentro de um pedido)</summary>

- `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `created_at`, `updated_at`
- `unit_price` é "congelado" no momento da venda
- `ForeignKey("products.id", ondelete="RESTRICT")`
</details>

### 3.2 Migration (Alembic)

```
alembic/versions/c1f605ddacfc_add_customers_and_orders_tables.py
```

Gerado via `alembic revision --autogenerate`, aplicado via `alembic upgrade head`.

### 3.3 Schemas (`app/schemas.py`)

- `CustomerCreate`, `CustomerUpdate`, `CustomerRead`
- `OrderItemCreate` — **não aceita preço do cliente**, só `product_id` e `quantity`. O preço vem sempre do banco
- `OrderCreate`, `OrderStatusUpdate` (com regex restringindo aos 3 status válidos)
- `OrderItemRead`, `OrderRead` — incluem `product_name` e `customer_name` resolvidos manualmente

### 3.4 Repositories (`app/repositories.py`)

- `CustomerRepository` — CRUD padrão, mesmo formato do `ProductRepository`
- `OrderRepository` / `OrderItemRepository` — `create()` usa `db.flush()` em vez de `db.commit()` (ver seção 3.5)

### 3.5 Service (`app/services.py`) — a parte mais importante

```python
def create_order(db, organization_id, customer_id, items):
    # 1. Verifica se o cliente existe
    # 2. Cria o cabeçalho do pedido (flush, não commit)
    # 3. Para cada item:
    #    - Verifica se o produto existe e está ativo
    #    - Verifica se há estoque suficiente
    #    - Desconta o estoque
    #    - Cria o item do pedido (flush)
    # 4. Só no final: db.commit() — tudo junto, ou nada
```

> **Por quê:** se um item de um pedido com vários produtos falhar (estoque insuficiente, por exemplo), o `rollback()` desfaz **tudo**, inclusive o pedido e os itens já processados antes do erro.

Exceções customizadas: `CustomerNotFoundError` (404), `ProductNotFoundError` (404), `InsufficientStockError` (409).

### 3.6 Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/customers` | Lista clientes |
| `POST` | `/api/customers` | Cria cliente |
| `PATCH` | `/api/customers/{id}` | Edita cliente |
| `DELETE` | `/api/customers/{id}` | Exclui cliente |
| `GET` | `/api/orders` | Lista pedidos (com itens e nomes resolvidos) |
| `POST` | `/api/orders` | Cria pedido (dispara a lógica de estoque) |
| `PATCH` | `/api/orders/{id}` | Atualiza status |
| `DELETE` | `/api/orders/{id}` | Exclui pedido — **restrito a `owner`/`admin`** |

---

## 🔹 Testes realizados (via Swagger `/docs`)

Autenticado como `admin@gestoria.dev`:

| # | Teste | Resultado |
|---|---|---|
| 1 | Criar cliente | ✅ `201` |
| 2 | Criar produto com estoque baixo | ✅ `201`, status `"Estoque baixo"` calculado corretamente |
| 3 | Criar pedido válido, dentro do estoque | ✅ `201`, estoque descontado, total calculado |
| 4 | Criar pedido acima do estoque disponível | ✅ `409`, mensagem clara, estoque **não** alterado (rollback confirmado) |
| 5 | Esgotar estoque e tentar de novo | ✅ Bloqueado corretamente (`disponível 0`) |
| 6 | Repor estoque e criar pedido de novo | ✅ `201`, resposta completa com nomes de cliente/produto |

**Pendente:**
- [ ] Cliente/produto inexistente (`404`)
- [ ] Atualização de status (`PATCH /api/orders/{id}`)
- [ ] Listagem de pedidos (`GET /api/orders`)
- [ ] Exclusão como `owner`/`admin` (`204`)
- [ ] Exclusão como `member` (deveria dar `403` — precisa de um usuário de teste `member`)
- [ ] Exclusão de cliente com pedido vinculado (deveria ser recusada)

---

## 🔹 Bugs encontrados e corrigidos durante a implementação

Todos foram erros de digitação — nenhum problema estrutural:

1. `Customer` → `Custumer`, `true` minúsculo, `null=False` em vez de `nullable=False`, `organization.id` sem o "s", `Order` indentado dentro de `Custumer` (`models.py`)
2. Import de `Customer`, `Order`, `OrderItem` faltando (`repositories.py`)
3. `FIeld` → `Field` (`schemas.py`)
4. `app/api/customers.py` nunca foi criado
5. `update_at` → `updated_at` (apareceu 2x, em arquivos diferentes)
6. `db.commmit()` → `db.commit()` (`services.py`)
7. `item_read` declarado vs. `item_reads` usado (`api/orders.py`)

---

## 🔹 Roadmap / próximos passos

- [ ] Completar os testes pendentes (seção acima)
- [ ] Corrigir o produto de teste (ficou com `name: "string"`, `price: 0`)
- [ ] Aplicar `require_role` (só owner/admin excluir) em Cliente e Produto
- [ ] **Conectar o `dashboard.html`** — trocar a lista fixa de Pedidos por chamadas reais a `/api/orders`
- [ ] Calcular "Total gasto" do cliente a partir dos pedidos `completed`
- [ ] Ainda 100% frontend (sem persistência real): Orçamentos, Relatórios, Log de Atividade, Dados da empresa

---

<sub>Documentação gerada em Agosto de 2026 como parte do desenvolvimento do GestorIA.</sub>
