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
      dependencies.py    sessão por cookie e papéis
    models/              tabelas, relacionamentos e sessões persistidas
    schemas/             validação de entrada e saída (Pydantic)
    repositories/        consultas e persistência
    services/            autenticação, sessões e regras transacionais
    security.py          hash de senhas e identificadores de sessão
    create_admin.py      criação interativa do primeiro proprietário
    production_setup.py  preparação segura do ambiente
    seed.py              dados fictícios opcionais para desenvolvimento
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

Na subida, o Compose aplica as migrations, prepara o ambiente e inicia o Uvicorn com reload.

| Recurso | Endereço |
| --- | --- |
| API e frontend | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/api/health |

Contas de demonstração ficam desabilitadas por padrão. Na primeira execução, crie um administrador:

```bash
docker compose exec api python -m app.create_admin
```

O comando solicita os dados da empresa e uma senha com pelo menos 12 caracteres, sem exibi-la no terminal.

Para parar: `Ctrl+C` ou `docker compose down`. Evite `docker compose down -v` se quiser manter os dados do Postgres.

### Sem Docker (API local)

É preciso Python 3.12+ e um PostgreSQL acessível (`DATABASE_URL` no ambiente).

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

export DATABASE_URL=postgresql+psycopg://gestoria:gestoria_dev@localhost:5432/gestoria
alembic upgrade head
python -m app.production_setup
python -m app.create_admin
uvicorn app.main:app --reload --port 8000
```

Se `python3 -m venv` falhar por falta de `ensurepip`:

```bash
python3 -m venv --without-pip .venv
.venv/bin/python get-pip.py        # https://bootstrap.pypa.io/get-pip.py
.venv/bin/pip install -r requirements-dev.txt
```

## Testes

A suíte local utiliza SQLite para a maioria dos testes. Os casos específicos de migrations e concorrência também devem ser validados no PostgreSQL descartável. Com o venv ativo:

```bash
source .venv/bin/activate
pytest -q
ruff check --no-cache app tests alembic/versions
ruff format --check --no-cache app tests alembic/versions
```

Para executar a suíte completa com PostgreSQL temporário, a partir da raiz do repositório:

```bash
docker compose -p gestoria-tests -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p gestoria-tests -f docker-compose.test.yml down --remove-orphans
```

Com o Compose local no ar:

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
