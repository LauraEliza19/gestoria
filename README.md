# GestorIA - base funcional com PostgreSQL

Primeira integração do protótipo com um backend real. O escopo foi mantido pequeno para liberar o desenvolvimento do frontend sem fechar prematuramente o domínio do produto.

## O que já funciona

- Login com senha protegida por Argon2 e sessão JWT.
- Usuário vinculado a uma empresa (tenant).
- Cadastro, listagem, edição e exclusão de produtos.
- Toda consulta de produto é filtrada pela empresa autenticada.
- PostgreSQL com migration versionada pelo Alembic.
- Documentação interativa da API em `http://localhost:8000/docs`.

As telas de clientes, pedidos, orçamentos, relatórios e IA continuam como protótipo local. Elas não foram persistidas nesta entrega.

## Rodar o projeto

Requisito: Docker Desktop aberto.

```bash
cp .env.example .env
docker compose up --build
```

Acesse `http://localhost:8000` e entre com:

- E-mail: `admin@gestoria.dev`
- Senha: `GestorIA@123`

Essas credenciais são apenas para desenvolvimento e podem ser alteradas no arquivo `.env`.

## Fluxo rápido para o Lucas

1. Fazer login pela tela inicial.
2. Abrir **Produtos** no menu lateral.
3. Clicar em **Novo produto** e salvar.
4. Atualizar a página: o registro continuará salvo no PostgreSQL.
5. Editar ou excluir o produto para testar o restante do CRUD.

## Estrutura do banco

| Tabela | Responsabilidade |
| --- | --- |
| `organizations` | Empresas atendidas pela plataforma |
| `users` | Identidade e credenciais dos usuários |
| `organization_members` | Papel do usuário dentro de cada empresa |
| `products` | Catálogo isolado por `organization_id` |

O status do estoque não é duplicado no banco: ele é calculado a partir de `stock_quantity` e `is_active`.

## Inspecionar o PostgreSQL

Entre no terminal do banco:

```bash
docker compose exec db psql -U gestoria -d gestoria
```

Comandos úteis para estudo:

```sql
\dt
\d products

SELECT id, name, price, stock_quantity, organization_id
FROM products
ORDER BY created_at DESC;

SELECT u.full_name, u.email, om.role, o.name AS organization
FROM users AS u
JOIN organization_members AS om ON om.user_id = u.id
JOIN organizations AS o ON o.id = om.organization_id;
```

Saia do `psql` com `\q`.

## API implementada

| Método | Rota | Uso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autenticar usuário |
| `GET` | `/api/auth/me` | Consultar sessão atual |
| `GET` | `/api/products` | Listar produtos da empresa |
| `POST` | `/api/products` | Cadastrar produto |
| `PATCH` | `/api/products/{id}` | Editar produto |
| `DELETE` | `/api/products/{id}` | Excluir produto |
| `GET` | `/api/health` | Verificar se a API está ativa |

## Organização do código

```text
backend/
  alembic/             migrations do banco
  app/
    api/               rotas e dependências HTTP
    models.py          tabelas SQLAlchemy
    schemas.py         validação de entrada e saída
    repositories.py    consultas controladas ao banco
    services.py        autenticação e regras de aplicação
    security.py        senha e token
    seed.py            usuário inicial de desenvolvimento
  tests/               testes de login, CRUD e isolamento
```

As rotas não executam SQL direto e o frontend nunca recebe credenciais do banco.

## Testes automatizados

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -q
```

Os testes usam SQLite somente como banco temporário e rápido. A aplicação executada pelo Docker usa PostgreSQL.

## Evolução do schema

Depois de alterar os modelos, gere e aplique uma nova migration:

```bash
docker compose exec api alembic revision --autogenerate -m "descricao da alteracao"
docker compose exec api alembic upgrade head
```

Não altere tabelas manualmente em ambientes compartilhados. Antes de publicar, troque `JWT_SECRET`, senha do PostgreSQL e credenciais demo.
