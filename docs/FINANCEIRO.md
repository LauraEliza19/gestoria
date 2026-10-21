# Financeiro

## 1. Objetivo

O módulo Financeiro registra categorias e lançamentos da empresa, separa
entradas e saídas e calcula um resumo realizado por período. Ele está disponível
no backend e na aplicação web.

O módulo oferece controle gerencial básico. Ele não deve ser interpretado como
contabilidade oficial, conciliação bancária, contas a pagar automatizadas ou
integração com instituições financeiras.

## 2. Estado atual

Funcionalidades implementadas:

- cadastro, consulta, edição, ativação e desativação de categorias;
- cadastro, consulta e edição de lançamentos;
- lançamentos de entrada e saída;
- situações pendente, paga e cancelada;
- filtros por período, tipo, situação e categoria;
- resumo de entradas realizadas, saídas realizadas e saldo;
- valores monetários armazenados com precisão decimal;
- isolamento por organização;
- permissões específicas de leitura e gerenciamento;
- auditoria de categorias e lançamentos;
- páginas web de resumo, cadastro e edição;
- testes de API, serviço, autorização e isolamento.

Ainda não estão implementados:

- exclusão definitiva de categorias e lançamentos;
- recorrência;
- parcelamento;
- anexos e comprovantes;
- conciliação bancária;
- integração com pagamentos;
- vínculo de lançamento com centro de custo;
- fluxo financeiro completo no aplicativo mobile.

## 3. Entidades

### 3.1 FinanceCategory

Representa uma categoria financeira da organização.

| Campo | Regra |
|---|---|
| `organization_id` | obtido da sessão |
| `name` | obrigatório e único por empresa |
| `description` | opcional |
| `is_active` | controla o uso da categoria |

Uma categoria inativa permanece no histórico, mas não deve ser usada em novos
lançamentos.

### 3.2 FinanceEntry

Representa uma movimentação financeira.

| Campo | Regra |
|---|---|
| `category_id` | categoria ativa da mesma organização |
| `description` | obrigatória |
| `amount` | positivo, com duas casas decimais |
| `entry_type` | `income` ou `expense` |
| `status` | `pending`, `paid` ou `cancelled` |
| `transaction_date` | data da movimentação |
| `paid_at` | momento da realização, quando aplicável |
| `notes` | observações opcionais |

O resumo considera somente lançamentos com situação `paid`.

### 3.3 FinanceAuditEvent

Registra o usuário, a organização, o tipo do evento, a entidade afetada, o
documento da alteração e o momento da operação.

## 4. Permissões

| Ação | `owner` | `admin` | `member` |
|---|:---:|:---:|:---:|
| Consultar resumo, categorias e lançamentos | sim | sim | somente com acesso aprovado |
| Criar e atualizar categorias | sim | sim | não |
| Criar e atualizar lançamentos | sim | sim | não |

O campo de aprovação financeira pertence ao vínculo do usuário com a
organização. O frontend adapta a navegação, mas a API sempre valida a permissão.

## 5. API

Prefixo: `/api/finance`.

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/categories` | listar categorias |
| `POST` | `/categories` | criar categoria |
| `GET` | `/categories/{id}` | consultar categoria |
| `PATCH` | `/categories/{id}` | atualizar ou ativar/desativar |
| `GET` | `/entries` | listar lançamentos com filtros |
| `POST` | `/entries` | criar lançamento |
| `GET` | `/entries/{id}` | consultar lançamento |
| `PATCH` | `/entries/{id}` | atualizar lançamento |
| `GET` | `/summary` | consultar entradas, saídas e saldo realizados |

Filtros de lançamento:

- `start_date`;
- `end_date`;
- `entry_type`;
- `status`;
- `category_id`.

O resumo aceita período, tipo e categoria.

## 6. Interface web

Rotas:

- `/financeiro`;
- `/financeiro/categorias/nova`;
- `/financeiro/categorias/:categoryId/editar`;
- `/financeiro/lancamentos/novo`;
- `/financeiro/lancamentos/:entryId/editar`.

A página principal apresenta:

- cards de entradas, saídas e saldo realizados;
- filtros;
- listagem de lançamentos;
- acesso ao gerenciamento de categorias;
- estados de carregamento, vazio, erro e sucesso.

## 7. Segurança e consistência

- o cliente nunca envia livremente a organização da operação;
- consultas e escritas são filtradas pela empresa da sessão;
- categoria e lançamento usam relacionamento composto com a organização;
- valores precisam ser maiores que zero;
- tipo e situação possuem constraints no banco;
- categorias duplicadas por empresa são rejeitadas;
- categorias inativas não podem receber novos lançamentos;
- mutações exigem proteção CSRF;
- alterações geram eventos de auditoria.

## 8. Relação com outros módulos

O saldo financeiro já pode alimentar o dashboard executivo. Centros de custo
existem na Gestão Interna, porém `FinanceEntry` ainda não possui
`cost_center_id`. Até essa integração ser implementada, a interface não deve
atribuir movimentações a centros de custo.

O aplicativo mobile apresenta o Financeiro como **Em integração**.

## 9. Evidências

- modelos: `backend/app/models/finance.py`;
- API: `backend/app/api/finance.py`;
- regras: `backend/app/services/finance.py`;
- repositórios: `backend/app/repositories/finance.py`;
- migration: `backend/alembic/versions/0012_finance_module.py`;
- frontend: `frontend/src/pages/Finance/`;
- serviço web: `frontend/src/services/finance.service.ts`;
- testes: arquivos financeiros em `backend/tests/`.

## 10. Próximos passos

1. integrar a experiência financeira ao mobile;
2. vincular lançamentos a centros de custo;
3. definir contas a pagar e receber sem confundi-las com contabilidade oficial;
4. criar paginação para grandes volumes;
5. avaliar anexos, recorrência e exportação;
6. ampliar relatórios e indicadores após validação das regras financeiras.
