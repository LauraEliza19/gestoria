# Backend — GestorIA

API FastAPI do GestorIA, com PostgreSQL, SQLAlchemy e Alembic. A arquitetura é organizada em camadas: as rotas tratam HTTP e autorização, os serviços concentram regras e transações, e os repositórios executam consultas e persistência.

## Responsabilidades atuais

- autenticação por sessão persistida em cookie `HttpOnly`;
- renovação, revogação e limite de tentativas de login;
- isolamento multiempresa;
- clientes, produtos, pedidos e orçamentos;
- criação protegida e idempotente de pedidos;
- dashboard executivo e alertas;
- produção, receitas, disponibilidade e consumo de estoque;
- documentos fiscais, fornecedores e eventos;
- funcionários, vínculos, centros de custo e ocorrências;
- categorias, lançamentos, resumo e auditoria financeira;
- Copiloto controlado com consulta autorizada;
- proteção CSRF, hosts/origens permitidos e cabeçalhos de segurança.

## Organização

```text
backend/
├── alembic/
│   └── versions/       migrations versionadas
├── app/
│   ├── api/            rotas HTTP, dependências e autorização
│   ├── models/         entidades e relacionamentos
│   ├── schemas/        contratos Pydantic
│   ├── repositories/   consultas e persistência
│   ├── services/       regras de negócio e transações
│   ├── config.py       configuração validada por ambiente
│   ├── database.py     sessão e engine SQLAlchemy
│   ├── security.py     senhas e identificadores de sessão
│   ├── http_security.py proteção CSRF e cabeçalhos HTTP
│   ├── create_admin.py criação do primeiro administrador
│   ├── production_setup.py validações de implantação
│   └── main.py         aplicação, routers e frontend compilado
├── tests/
├── requirements.txt
├── requirements-dev.txt
└── Dockerfile
```

Fluxo principal:

```text
rota → autorização → service → repository → model → PostgreSQL
```

## Executar com Docker

Na raiz do repositório:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose run --rm security-init
docker compose up -d --build
```

O Compose inicia o PostgreSQL, aplica migrations, valida o ambiente e executa o Uvicorn com recarregamento no desenvolvimento.

| Recurso | Endereço |
|---|---|
| Aplicação web e API | `http://localhost:8000` |
| Swagger em desenvolvimento | `http://localhost:8000/docs` |
| ReDoc em desenvolvimento | `http://localhost:8000/redoc` |
| Saúde da API | `http://localhost:8000/api/health` |

Contas de demonstração ficam desabilitadas por padrão. Crie o primeiro administrador:

```powershell
docker compose exec api python -m app.create_admin
```

Para acompanhar a API:

```powershell
docker compose logs --tail 100 -f api
```

Evite `docker compose down -v` quando quiser preservar o volume do PostgreSQL.

## Executar sem Docker

Requer Python 3.12 ou superior e PostgreSQL acessível:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
$env:DATABASE_URL = 'postgresql+psycopg://gestoria:gestoria_dev@localhost:5432/gestoria'
alembic upgrade head
python -m app.production_setup
python -m app.create_admin
uvicorn app.main:app --reload --port 8000
```

Também é necessário ter o build do frontend em `frontend/dist/`, pois a inicialização da aplicação valida esse diretório.

## Grupos de API

| Prefixo | Responsabilidade |
|---|---|
| `/api/auth` | login, sessão atual, renovação e logout |
| `/api/organization` | perfil da empresa autenticada |
| `/api/dashboard` | visão executiva e alertas |
| `/api/customers` | clientes e perfil comercial |
| `/api/products` | catálogo e estoque de produtos |
| `/api/orders` | pedidos, propostas, confirmação, comprovantes e auditoria |
| `/api/quotes` | orçamentos e conversão em pedido |
| `/api/production` | ingredientes, estoque produtivo, receitas e consumo |
| `/api/fiscal-documents` | documentos, vínculos, recebimentos e eventos fiscais |
| `/api/fiscal-suppliers` | fornecedores fiscais |
| `/api/finance` | categorias, lançamentos e resumo financeiro |
| `/api/management` | funcionários, vínculos, centros de custo e ocorrências |
| `/api/copilot` | consultas controladas do Copiloto |
| `/api/health` | disponibilidade da aplicação |

A especificação detalhada das rotas fica disponível no Swagger durante o desenvolvimento.

## Regras de segurança

- a organização vem da sessão, nunca de um identificador livre enviado pelo cliente;
- toda mutação em `/api/` exige `X-CSRF-Protection: 1`;
- origens não autorizadas são rejeitadas;
- senhas usam Argon2;
- somente o hash do identificador da sessão é persistido;
- permissões são verificadas no backend;
- operações críticas utilizam transações, locks ou idempotência conforme o domínio;
- chaves de assinatura e credenciais permanecem somente no backend;
- documentação OpenAPI é desabilitada em produção.

## Testes e qualidade

Com o ambiente virtual ativo:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check --no-cache app tests alembic\versions
.\.venv\Scripts\python.exe -m ruff format --check --no-cache app tests alembic\versions
```

A maioria dos testes pode usar SQLite. Casos de migration e concorrência também devem ser validados no PostgreSQL descartável:

```powershell
docker compose -p gestoria-tests -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p gestoria-tests -f docker-compose.test.yml down --remove-orphans
```

## Migrations

Após alterar modelos:

```powershell
docker compose exec api alembic revision --autogenerate -m "descricao da alteracao"
docker compose exec api alembic upgrade head
```

Crie sempre uma migration nova. Não reescreva uma migration que já possa ter sido aplicada por outra pessoa ou ambiente.

## Produção

`docker-compose.production.yml` é independente do Compose de desenvolvimento. Ele utiliza PostgreSQL em rede interna, Caddy para HTTPS e Uvicorn sem documentação pública.

Antes de implantar, configure ao menos:

- `POSTGRES_PASSWORD`;
- `SITE_DOMAIN`;
- `OPERATION_SIGNING_KEYS`;
- `OPERATION_ACTIVE_KEY_ID`;
- hosts e origens permitidos.

Consulte [Sessões seguras](../docs/SEGURANCA-SESSOES.md), [Segurança de pedidos](../docs/SEGURANCA_PEDIDOS.md) e a [política de segurança](../SECURITY.md).
