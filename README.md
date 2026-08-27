# GestorIA

Plataforma de gestão empresarial com uma experiência orientada por inteligência artificial. O projeto está em desenvolvimento acadêmico com estrutura de aplicação real, backend em camadas, persistência PostgreSQL e isolamento dos dados de cada empresa.

## Estado atual do MVP

- Autenticação com senha protegida por Argon2 e sessão JWT.
- Usuários vinculados a empresas por papéis (`owner`, `admin` e `member`).
- CRUD de produtos com preço, estoque e status calculado.
- CRUD de clientes com telefone normalizado e único por empresa.
- Pedidos com múltiplos produtos, preço histórico, baixa transacional e recomposição de estoque em cancelamentos/exclusões.
- Total gasto do cliente calculado a partir dos pedidos concluídos.
- Isolamento multi-tenant em todas as consultas de negócio.
- Migrations versionadas com Alembic e testes automatizados da API.

Orçamentos, relatórios, atividade, dados cadastrais da empresa e a integração completa da IA ainda permanecem como protótipos locais.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | HTML, CSS e JavaScript |
| API | Python 3.12 e FastAPI |
| Persistência | PostgreSQL 17 e SQLAlchemy 2 |
| Migrations | Alembic |
| Autenticação | JWT e Argon2 |
| Ambiente | Docker Compose |
| Qualidade | Pytest e Ruff |

## Executar com Docker

Requisito: Docker Desktop aberto.

No PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

No Linux ou macOS:

```bash
cp .env.example .env
docker compose up --build
```

Na inicialização, o projeto aplica automaticamente todas as migrations e prepara o usuário de demonstração. Acesse:

- Aplicação: `http://localhost:8000`
- Documentação da API: `http://localhost:8000/docs`
- E-mail: `admin@gestoria.dev`
- Senha: `GestorIA@123`

As credenciais são exclusivas do ambiente de desenvolvimento e podem ser alteradas no `.env`.

> Não execute `docker compose down -v` se quiser preservar os registros do PostgreSQL local. A opção `-v` remove o volume do banco.

## Estrutura do banco

| Tabela | Responsabilidade |
| --- | --- |
| `organizations` | Empresas atendidas pela plataforma |
| `users` | Identidade e credenciais dos usuários |
| `organization_members` | Papel do usuário em cada empresa |
| `products` | Catálogo e estoque isolados por empresa |
| `customers` | Clientes isolados por empresa |
| `orders` | Cabeçalho, cliente, status e total do pedido |
| `order_items` | Produtos, quantidades e preços históricos do pedido |

O `organization_id` delimita os dados de cada empresa. Pedidos são gravados em uma única transação: se qualquer produto não existir ou não tiver estoque suficiente, nenhuma alteração é persistida.

Os índices da migration `0003` otimizam as consultas mais usadas pelo painel: listagem cronológica, busca de clientes, pedidos por cliente e filtros por status.

## Conferir os clientes no PostgreSQL

```powershell
docker compose exec db psql -U gestoria -d gestoria
```

No `psql`:

```sql
SELECT c.id, c.name, c.phone, c.created_at, o.name AS organization
FROM customers AS c
JOIN organizations AS o ON o.id = c.organization_id
ORDER BY c.created_at DESC;
```

Os registros exibidos na tela de Clientes vêm de `GET /api/customers`; não existe uma lista fixa no frontend. Saia do terminal com `\q`.

## Rotas implementadas

| Método | Rota | Uso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autenticar usuário |
| `GET` | `/api/auth/me` | Consultar a sessão atual |
| `GET` | `/api/products` | Listar produtos da empresa |
| `POST` | `/api/products` | Cadastrar produto |
| `PATCH` | `/api/products/{id}` | Editar produto |
| `DELETE` | `/api/products/{id}` | Excluir produto sem vínculos |
| `GET` | `/api/customers` | Listar clientes com total gasto |
| `POST` | `/api/customers` | Cadastrar cliente |
| `PATCH` | `/api/customers/{id}` | Editar cliente |
| `DELETE` | `/api/customers/{id}` | Excluir cliente sem pedidos |
| `GET` | `/api/orders` | Listar pedidos com seus itens |
| `POST` | `/api/orders` | Criar pedido e baixar estoque |
| `PATCH` | `/api/orders/{id}` | Atualizar o status do pedido |
| `DELETE` | `/api/orders/{id}` | Excluir pedido e recompor estoque como owner/admin |
| `GET` | `/api/health` | Verificar a disponibilidade da API |

## Organização do backend

```text
backend/
  alembic/             migrations versionadas do banco
  app/
    api/               rotas e dependências HTTP
    models.py          tabelas e relacionamentos SQLAlchemy
    schemas.py         validação de entrada e saída
    repositories.py    consultas e operações de persistência
    services.py        autenticação e regras transacionais
    security.py        senha e token
    seed.py            dados iniciais de desenvolvimento
  tests/               testes de API, transações e isolamento
```

As rotas não executam SQL diretamente e o frontend nunca recebe credenciais do banco.

## Testes e qualidade

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest -q
ruff check app tests alembic\versions
```

Os testes usam um SQLite temporário com chaves estrangeiras ativadas. A aplicação executada pelo Docker utiliza PostgreSQL.

## Evoluir o schema

Depois de alterar os modelos, gere uma nova migration em vez de editar uma migration que já foi aplicada:

```powershell
docker compose exec api alembic revision --autogenerate -m "descricao da alteracao"
docker compose exec api alembic upgrade head
```

Antes de qualquer implantação pública, altere `JWT_SECRET`, senha do PostgreSQL e credenciais de demonstração.
