# GestorIA

Plataforma de gestão empresarial com uma experiência orientada por inteligência artificial. O projeto está em desenvolvimento acadêmico com estrutura de aplicação real, backend em camadas, persistência PostgreSQL e isolamento dos dados de cada empresa.

## Estado atual do MVP

- Autenticação com senha protegida por Argon2 e sessão JWT.
- Usuários vinculados a empresas por papéis (`owner`, `admin` e `member`).
- CRUD manual de produtos com catálogo completo, custo, estoque, validade e dados fiscais.
- CRUD manual de clientes com dados pessoais, contato, endereço, desconto e telefone normalizado.
- Pedidos com múltiplos produtos, preço histórico, baixa transacional e recomposição de estoque em cancelamentos/exclusões.
- Total gasto do cliente calculado a partir dos pedidos concluídos.
- Isolamento multi-tenant em todas as consultas de negócio.
- Migrations versionadas com Alembic e testes automatizados da API.
- Radar operacional com prioridades e indicadores calculados a partir de clientes, produtos, pedidos e orçamentos; página do Copiloto migrada para React.

Orçamentos e dados cadastrais da empresa já usam a API. Relatórios e interpretação por IA ainda têm partes simuladas. O histórico visual antigo permanece local; os eventos de segurança de pedidos agora são persistidos e consultáveis pela API.

A criação direta de pedidos exige proposta assinada e confirmação. Consulte [atualizações e teste/uso](docs/SEGURANCA_PEDIDOS.md) para o contrato, limites e resultados de validação.

- HMAC-SHA256 com chave exclusiva do servidor, proposta com validade e idempotência.
- Pedido, estoque, comprovante e auditoria confirmados na mesma transação.
- Rota antiga de criação responde HTTP 428; conversão de orçamento mantém seu fluxo existente e está fora deste primeiro escopo criptográfico.

## Atualização fiscal — setembro/2026

Notas de saída agora exigem pedido da mesma empresa, com destinatário, itens e valores conferidos no servidor. Cancelamentos preservam o histórico; apenas uma saída ativa é permitida por pedido. Entradas usam fornecedor e recebimento de estoque explícito.

Leia [o mapeamento, as regras, a migração e o roteiro de testes](docs/FISCAL_ATUALIZACOES_E_TESTES.md) antes de atualizar um banco existente. A nova revisão é `0006_fiscal_integrity`; o registro de eventos externos não constitui emissão ou autorização pela SEFAZ.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 e Lucide React |
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
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose run --rm security-init
docker compose up -d --build
```

No Linux ou macOS:

```bash
test -f .env || cp .env.example .env
docker compose run --rm security-init
docker compose up -d --build
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
| `order_operations` | Propostas assinadas, idempotência e comprovantes históricos |
| `order_audit_events` | Eventos autenticados de preparação, execução, rejeição e cancelamento |
| `fiscal_documents` | Notas vinculadas, evidências e datas fiscais |
| `fiscal_document_items` | Itens e valores capturados para o histórico |
| `fiscal_events` | Ações fiscais com usuário responsável |
| `suppliers` | Fornecedores de notas de entrada |
| `fiscal_stock_movements` | Recebimentos e estornos de entrada |

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
| `POST` | `/api/orders` | Criação antiga bloqueada com HTTP 428 |
| `POST` | `/api/orders/proposals` | Preparar proposta assinada, sem alterar estoque |
| `POST` | `/api/orders/proposals/{id}/confirm` | Confirmar proposta e registrar pedido uma única vez |
| `POST` | `/api/orders/proposals/{id}/cancel` | Descartar proposta pendente |
| `GET` | `/api/orders/proposals/{id}/receipt` | Consultar comprovante verificado |
| `GET` | `/api/orders/security/events` | Consultar eventos autorizados e sua integridade |
| `PATCH` | `/api/orders/{id}` | Atualizar o status do pedido |
| `DELETE` | `/api/orders/{id}` | Excluir pedido sem histórico fiscal e recompor estoque como owner/admin |
| `GET` | `/api/fiscal-documents` | Listar e filtrar documentos fiscais |
| `POST` | `/api/fiscal-documents` | Registrar saída por pedido ou entrada por fornecedor/itens |
| `PATCH` | `/api/fiscal-documents/{id}` | Registrar transição permitida com evidência externa |
| `DELETE` | `/api/fiscal-documents/{id}` | Exclusão bloqueada (409), histórico preservado |
| `GET` | `/api/fiscal-documents/{id}` | Consultar detalhes e eventos |
| `POST` | `/api/fiscal-documents/{id}/link-order` | Conciliar saída histórica |
| `POST` | `/api/fiscal-documents/{id}/receive` | Confirmar recebimento de entrada uma única vez |
| `GET/POST` | `/api/fiscal-suppliers` | Listar/cadastrar fornecedores |
| `PATCH` | `/api/fiscal-suppliers/{id}` | Ativar/desativar fornecedor |
| `GET` | `/api/health` | Verificar a disponibilidade da API |

## Organização

O backend segue arquitetura em camadas. O frontend usa React com TypeScript, React Router e Tailwind CSS.

```text
frontend/
  src/
    app/                  roteamento e composição da aplicação
    layouts/              layouts autenticado e de navegação
    pages/                telas React por domínio
    services/             cliente HTTP e autenticação
    styles/               entrada Tailwind e tokens visuais
  dist/                   build de produção gerado pelo Vite

backend/
  alembic/               migrations versionadas do banco
  app/
    api/                 controllers HTTP (rotas)
    models/              tabelas e relacionamentos SQLAlchemy
    schemas/             validação de entrada e saída
    repositories/        consultas e persistência
    services/            autenticação e regras transacionais
    security.py          senha e token
    seed.py              dados iniciais de desenvolvimento
  tests/                 testes de API, transações e isolamento
```

As regras transacionais ficam nos services e as consultas fiscais principais nos repositories. O frontend nunca recebe credenciais do banco.

Para regenerar o build Tailwind/React depois de alterar componentes:

```bash
cd frontend
npm install
npm run build
```

## Testes e qualidade

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest -q
ruff check app tests alembic\versions
```

Os testes locais usam SQLite temporário com chaves estrangeiras ativadas. Para validar também migrations e concorrência no PostgreSQL 17, use `docker compose -p gestoria-fiscal-tests -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests`. Consulte os resultados e limites no relatório fiscal.

## Evoluir o schema

Depois de alterar os modelos, gere uma nova migration em vez de editar uma migration que já foi aplicada:

```powershell
docker compose exec api alembic revision --autogenerate -m "descricao da alteracao"
docker compose exec api alembic upgrade head
```

Antes de qualquer implantação pública, altere `JWT_SECRET`, senha do PostgreSQL e credenciais de demonstração.
