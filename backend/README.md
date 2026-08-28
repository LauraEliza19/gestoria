# Backend — GestorIA

API FastAPI com PostgreSQL, SQLAlchemy e Alembic. Arquitetura em camadas (mais adequada que MVC clássico para esta API): as rotas não executam SQL; regras de negócio ficam nos services.

## Organização

```text
backend/
  app/
    api/                 controllers HTTP (rotas)
      auth.py
      products.py
      customers.py
      orders.py
      dependencies.py    sessão JWT e papéis
    models/              tabelas e relacionamentos
    schemas/             validação de entrada e saída (Pydantic)
    repositories/        consultas e persistência
    services/            autenticação e regras transacionais
    security.py          senha (Argon2) e token JWT
    seed.py              usuário de demonstração
    database.py
    config.py
    main.py              app FastAPI + páginas do frontend
  alembic/               migrations versionadas
  tests/                 testes unitários e de API
  requirements.txt
  requirements-dev.txt
  Dockerfile
```

Fluxo de uma operação: **rota → service → repository → model**.

## Como executar

### Docker (recomendado)

Na raiz do repositório, com o Docker Desktop aberto:

```bash
cd ..
cp .env.example .env          # só na primeira vez
docker compose up --build
```

Na subida: migrations (`alembic upgrade head`), seed e Uvicorn com reload.

| Recurso | Endereço / valor |
| --- | --- |
| API e frontend | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/api/health |
| E-mail demo | `admin@gestoria.dev` |
| Senha demo | `GestorIA@123` |

Credenciais só para desenvolvimento; altere-as no `.env` da raiz.

Para parar: `Ctrl+C` ou `docker compose down`. Evite `docker compose down -v` se quiser manter os dados do Postgres.

### Sem Docker (API local)

É preciso Python 3.12+ e um PostgreSQL acessível (`DATABASE_URL` no ambiente).

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

export DATABASE_URL=postgresql+psycopg://gestoria:gestoria_dev@localhost:5432/gestoria
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Se `python3 -m venv` falhar por falta de `ensurepip`:

```bash
python3 -m venv --without-pip .venv
.venv/bin/python get-pip.py        # https://bootstrap.pypa.io/get-pip.py
.venv/bin/pip install -r requirements-dev.txt
```

## Testes

Os testes usam SQLite em memória (não precisam do Postgres). Com o venv ativo:

```bash
source .venv/bin/activate
pytest -q
ruff check app tests alembic/versions
```

Com o Compose no ar:

```bash
docker compose exec api pytest -q
```

Não use o `pytest` instalado via `apt` no sistema: ele não tem FastAPI nem o restante das dependências.

## Migrations

Depois de alterar `app/models`, gere uma migration nova — não edite uma que já foi aplicada:

```bash
docker compose exec api alembic revision --autogenerate -m "descricao da alteracao"
docker compose exec api alembic upgrade head
```

## Rotas da API

| Método | Rota | Uso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autenticar |
| `GET` | `/api/auth/me` | Sessão atual |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/products` | CRUD de produtos |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/customers` | CRUD de clientes |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/orders` | Pedidos e estoque |
| `GET` | `/api/health` | Disponibilidade |

Excluir cliente, produto ou pedido exige papel `owner` ou `admin`. Pedidos são transacionais: estoque insuficiente gera `409` e nada é gravado.
