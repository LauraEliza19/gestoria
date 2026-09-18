# GestorIA — vínculos fiscais, histórico e estoque

Atualização: 17/09/2026. Base: último `gestoria-main(1).zip` enviado nesta conversa, SHA-256 `d29a2fd672e86fe70bf1d9073edb907fbb821ddfafccf9ed1fe8f9a1a7db58d9`.

## 1. Resultado e escopo

O módulo fiscal passa a exigir um pedido da própria empresa para cada nova saída. Destinatário, itens e valores são copiados pelo servidor; a interface não pode substituí-los. Entradas têm fornecedor e produtos próprios e um recebimento de estoque separado. Cancelamentos preservam documentos, itens e eventos; uma nova emissão usa outro registro e outra numeração.

Esta implementação organiza documentos e registra evidências informadas por um usuário autorizado. **Não emite NF-e/NFC-e/NFS-e, não consulta a SEFAZ, não valida a autenticidade de protocolos e não calcula tributos.** `Autorizada` significa que um responsável registrou uma autorização externa. Os estados e transições aqui descritos são regras internas deste MVP; não substituem regras de um emissor fiscal.

## 2. Mapeamento do projeto recebido

| Área | Encontrado no ZIP | Alteração realizada |
| --- | --- | --- |
| Pedidos | `Order`, `OrderItem`; criação manual com proposta assinada, confirmação e preço histórico; conversão de orçamento existente | Mantidos; cancelamento bloqueado quando há nota ativa e exclusão bloqueada quando existe qualquer histórico fiscal |
| Modelo fiscal | `FiscalDocument` em `app/models/__init__.py`; `organization_id` obrigatório e `order_id` opcional | Modelo extraído para `app/models/fiscal.py`; vínculos por empresa, responsáveis, datas, protocolos e origem do histórico |
| Tabelas fiscais | Somente `fiscal_documents`; sem itens fiscais, fornecedor ou movimentação de entrada | Adicionadas `suppliers`, `fiscal_document_items`, `fiscal_events`, `fiscal_stock_movements` |
| API | `api/fiscal.py`: GET, POST manual, PATCH de qualquer status e DELETE físico | Mesma base de rotas, com regras transacionais e novas operações de conciliação/recebimento |
| Schemas | Valores, participante e status recebidos do cliente | Saída recebe pedido e metadados; entrada recebe fornecedor/itens; campos de autoridade do servidor rejeitados com 422 |
| Repository | `repositories/fiscal.py` consultava e fazia commits | Consultas por empresa; transação comandada pelo novo serviço fiscal |
| Service | Não havia serviço fiscal | `services/fiscal.py`: autorização, bloqueios, snapshots, eventos e estoque |
| React | `/notas-fiscais` em `FiscalDocumentsPage.tsx`; criação isolada, seleção livre de status e exclusão | Seleção de pedido, entrada com fornecedor, transições permitidas, evidência externa, conciliação, histórico e recebimento explícito |
| Vínculo com pedido | Existia no banco, mas não era exigido nem selecionado na tela | Obrigatório nas novas saídas; atalho “Notas fiscais” na lista de pedidos |
| Dados antigos | Podiam ter pedido nulo, usuário desconhecido e apenas uma data de emissão | Preservados e marcados como históricos, sem inventar informações |

Foram preservados os arquivos e fluxos recentes de criação protegida de pedidos, validação de NCM/CEST/origem, Radar, filtros comerciais e última compra calculada no backend. O ZIP é a evidência do estado recebido; sem o histórico `.git` original não é possível atribuir cada trecho a um autor ou confirmar os hashes dos commits citados na conversa.

### Migrations encontradas

Cadeia existente, em ordem:

`0001 → c1f605ddacfc → 0003 → d2a10c3ad5ef → cbd36bd2ca60 → 20796917ffea → e8559033a8ca → 0004_protected_orders → 0005_fiscal_documents`

Nova revisão: **`0006_fiscal_integrity`**, arquivo `backend/alembic/versions/0006_fiscal_order_integrity.py`. Nenhuma migration anterior foi reescrita.

**Não foi acessado o banco da equipe.** Revisões presentes no código não provam quais já estão aplicadas. Confira com `alembic current` e `SELECT version_num FROM alembic_version`, conforme o procedimento de implantação abaixo.

## 3. Vínculos e preservação

| Informação | Saída nova | Entrada nova | Registro anterior à migração |
| --- | --- | --- | --- |
| `organization_id` | Sessão autenticada | Sessão autenticada | Preservado |
| `order_id` | Obrigatório; pedido da mesma empresa e não cancelado | Sempre nulo; não usa pedido de venda | Pode ser nulo até conciliação explícita |
| Destinatário/fornecedor | `customer_id` do pedido; nome/documento copiados | `supplier_id` ativo da empresa; nome/documento copiados | Identificação original preservada |
| Itens | Produtos, quantidades e preços históricos do pedido | Produtos ativos da empresa, quantidades e preços informados | Não são inventados; saída pode recuperar itens do pedido na conciliação |
| Valor | Total do pedido, conferido com a soma dos itens | Soma calculada no backend | Valor original preservado |
| Responsáveis | `created_by_id` e `updated_by_id`; eventos com ator | Igual à saída | Criador desconhecido continua nulo; quem concilia fica no evento |
| Status inicial | `Em processamento` | `Em processamento` | Status original |
| Datas | `created_at`, `issue_date`, `authorized_at`, `cancelled_at` | Mesmas datas; mais `stock_received_at` | Datas não conhecidas continuam nulas |

`issue_date` representa a data de emissão **informada**, com precisão de dia, como já existia. Autorização e cancelamento usam data/hora com fuso. Datas de eventos ainda não ocorridos ficam nulas. O servidor rejeita emissão futura, eventos anteriores à emissão e cancelamento anterior à autorização.

`fiscal_document_items` mantém nome, unidade, quantidade, preço e os códigos fiscais capturados no registro. Preços vêm do pedido, mesmo que o catálogo já tenha outro preço. Metadados cadastrais são os disponíveis na captura. Alterar/desativar produto ou cliente depois não reescreve o documento. Subtotais retêm cinco casas decimais; o total usa soma seguida de arredondamento `ROUND_HALF_UP` para dois centavos, compatível com pedidos fracionários.

Chaves estrangeiras compostas `(organization_id, id)` impedem associar nota a pedido/cliente/fornecedor de outra empresa e itens a produtos/documentos de outra empresa. Referências fiscais usam `RESTRICT`, preservando registros vinculados. Isso não é RLS: a aplicação continua responsável por filtrar leituras pela empresa. As permissões do usuário de banco também precisam ser administradas pela equipe.

## 4. Status, unicidade e reemissão

| Status atual | Próximos estados internos permitidos |
| --- | --- |
| Em processamento | Autorizada, Rejeitada, Inutilizada, Denegada, Cancelada |
| Autorizada | Cancelada |
| Rejeitada | Em processamento, Inutilizada |
| Cancelada, Inutilizada, Denegada | Nenhum; permanecem no histórico |

- São consideradas **ativas** as saídas `Em processamento` e `Autorizada`. Um índice único parcial no banco limita essas notas a uma por `(organization_id, order_id)`. Bloqueios do pedido e revalidação complementam a restrição.
- Uma nota cancelada não é apagada nem reativada. A reemissão cria outra nota para o mesmo pedido, com outro número/série/modelo e nova evidência externa.
- `(empresa, modelo, série, número)` permanece reservado nas saídas, inclusive canceladas. Nas entradas a identidade inclui também o fornecedor.
- Rejeitada, Inutilizada e Denegada liberam a reserva de nota ativa. Repetir uma rejeitada no mesmo registro só é permitido se nenhum outro registro ativo tiver sido criado para o pedido. Uma rejeitada também não libera sua numeração para outro registro.
- `Autorizada` exige data/hora e protocolo. `Cancelada` exige data/hora e motivo; quando a nota estava autorizada, exige também protocolo externo de cancelamento.
- Repetir exatamente o mesmo evento não duplica o histórico. Tentar trocar data/protocolo/motivo de um evento já registrado retorna conflito.
- Não existe edição genérica de itens, participante, valor ou vínculo de uma nota nova. Erros devem ser tratados pelo fluxo de status e novo registro apropriado. Metadados não são sobrescritos silenciosamente.
- Uma nota fiscal de saída **não baixa estoque novamente**. Essa baixa já pertence ao pedido. Cancelar a nota também não repõe o estoque da venda: primeiro resolve-se a nota e depois, se cabível, cancela-se o pedido.

Índices adicionais: `(organization_id, order_id)`, `(organization_id, status)` e `(organization_id, number)`, além dos índices anteriores de empresa/data e empresa/tipo/status. O primeiro campo desses índices atende também consultas que começam pela empresa; não foi criado um índice isolado redundante para `organization_id`.

## 5. Entradas e estoque

1. Cadastrar fornecedor com CPF/CNPJ de 11/14 dígitos; a validação atual é de formato, sem consulta cadastral ou cálculo de dígitos verificadores.
2. Registrar nota de entrada com fornecedor ativo e um ou mais produtos ativos da empresa. Cada produto aparece uma vez; quantidades têm até três casas e valores unitários até duas.
3. Registrar autorização externa com protocolo/data.
4. Depois de conferir o recebimento físico, acionar **Confirmar recebimento no estoque**.

Cadastro e autorização não movimentam estoque. O recebimento soma as quantidades em uma única transação com o evento e os lançamentos de `fiscal_stock_movements`. Repetições não somam novamente. Há unicidade por item/tipo de movimento e bloqueio de produtos durante a atualização.

Cancelar uma entrada recebida estorna suas quantidades uma única vez. Se isso deixaria estoque negativo, a transação inteira é rejeitada: nota, estoque e eventos permanecem como estavam. É necessário reconciliar o inventário antes de tentar novamente. Desativar um fornecedor não apaga seu histórico; o endpoint de atualização permite ativar/desativar.

Entradas antigas não recebem itens/fornecedor fictícios e não geram movimentação retroativa. A conciliação dessas entradas exige conferir documentos e inventário; essa importação retroativa não foi automatizada neste escopo.

## 6. Tratamento dos dados antigos e migração

A migração marca todos os registros existentes com `is_legacy=true` e `snapshot_source=legacy_unverified`. Não descarta notas, não altera seus valores/status e não deduz autoria ou protocolos.

Antes do DDL, a migração bloqueia escritas nas tabelas envolvidas e verifica:

- Duas saídas ativas ligadas ao mesmo pedido.
- Numeração repetida em saídas da mesma empresa/modelo/série, mesmo entre canceladas.
- Nota de entrada ligada a pedido de venda; vínculo de pedido ou cliente fora da empresa da nota.

Se houver inconsistência, a migração falha e reverte a transação. **Não corrige cancelamentos ou números automaticamente.** Use `docs/fiscal-preflight.sql` para localizar os registros; qualquer ajuste precisa ser baseado nos documentos reais. A migração demanda janela de manutenção, e não uma promessa de atualização sem bloqueio.

Saídas antigas sem pedido podem permanecer no histórico. Se uma delas estiver ativa, novas saídas da empresa ficam bloqueadas até a pendência ser resolvida, para evitar duplicar uma operação cuja origem ainda é desconhecida.

Na tela de detalhes de uma saída histórica, **Confirmar vínculo** exige pedido da mesma empresa, justificativa, valor compatível e destinatário compatível (documento, ou nome quando o documento antigo não existe). Pedido já vinculado não pode ser substituído. Os itens recuperados são identificados como capturados na conciliação, não como o conteúdo comprovado da emissão original. Históricos cancelados também podem ser conciliados. Notas históricas não conciliadas não podem entrar em um estado ativo novo.

O downgrade só é aceito se não houver fornecedores, itens, eventos, movimentações ou novos vínculos/registros criados por esta revisão. Havendo dados novos, ele falha antes de remover tabelas. Uma reversão posterior deve ser planejada a partir de backup revisado, para não perder a operação ocorrida desde a implantação.

## 7. Contrato da API

Todas as rotas são autenticadas e delimitadas pela empresa. Leitura é permitida aos membros; alterações fiscais exigem `owner` ou `admin`, com usuário e vínculo ativos revalidados no serviço.

| Método e rota | Comportamento |
| --- | --- |
| `GET /api/fiscal-documents` | Lista com filtros `document_type`, `status`, `search`, `order_id` |
| `GET /api/fiscal-documents/{id}` | Detalhes, snapshots, datas, eventos e `allowed_statuses` |
| `POST /api/fiscal-documents` | Cria saída vinculada ou entrada com fornecedor/itens |
| `PATCH /api/fiscal-documents/{id}` | Registra uma transição permitida e suas evidências |
| `POST /api/fiscal-documents/{id}/link-order` | Concilia uma saída histórica, com `order_id` e `reason` |
| `POST /api/fiscal-documents/{id}/receive` | Confirma recebimento de entrada; corpo vazio |
| `DELETE /api/fiscal-documents/{id}` | Retorna 409 para documento existente; exclusão desabilitada |
| `GET /api/fiscal-suppliers` | Lista fornecedores da empresa, incluindo inativos |
| `POST /api/fiscal-suppliers` | Cadastra `name` e `document` |
| `PATCH /api/fiscal-suppliers/{id}` | Atualiza somente `is_active` |

Saída, exemplo de corpo (substitua o UUID e a data):

```json
{"document_type":"saida","order_id":"UUID-DO-PEDIDO","number":"100","series":"1","model":"55","issue_date":"2026-09-17"}
```

Entrada:

```json
{"document_type":"entrada","supplier_id":"UUID-DO-FORNECEDOR","number":"200","series":"1","model":"55","issue_date":"2026-09-17","items":[{"product_id":"UUID-DO-PRODUTO","quantity":"3.125","unit_price":"4.50"}]}
```

Evento de autorização, apenas quando correspondente a um evento externo real:

```json
{"status":"Autorizada","occurred_at":"2026-09-17T10:00:00-03:00","protocol":"PROTOCOLO-EXTERNO"}
```

A criação deixa de aceitar `value`, `participant_name`, `status`, `organization_id`, `created_by_id` ou `is_legacy`; clientes antigos precisam ser atualizados junto com o backend. A chave de acesso, quando informada, exige 44 dígitos; não há validação criptográfica de documento XML. Falhas de validação retornam 422; ausência/empresa diferente retorna 404; conflitos de regra ou unicidade retornam 409.

## 8. Como aplicar com Docker / PowerShell

### Primeiro, testar isoladamente

Na raiz do projeto atualizado, com Docker Desktop aberto:

```powershell
docker compose -p gestoria-fiscal-tests -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p gestoria-fiscal-tests -f docker-compose.test.yml down
```

O Compose de testes usa um PostgreSQL 17 temporário próprio e não monta o volume do banco da aplicação. O Dockerfile de testes foi ajustado para construir o frontend React antes de executar Pytest. Essa execução habilita também os testes que dependem de `TEST_POSTGRES_URL`.

### Atualizar um banco existente

Use a pasta/repositório e o projeto Compose habituais, para não apontar sem perceber para um volume vazio. Preserve `.env`, chaves HMAC e `.git`. Os comandos abaixo usam usuário/banco de desenvolvimento `gestoria`; ajuste-os se o seu `.env` usar outros nomes.

1. Coloque os arquivos atualizados em uma branch de trabalho. Não use `git push --force`; faça commit e pull request pelo fluxo da equipe.
2. Pare a API e faça um backup antes de migrar:

```powershell
docker compose stop api
docker compose exec db pg_dump -U gestoria -d gestoria -Fc -f /tmp/gestoria-antes-fiscal.dump
docker compose cp db:/tmp/gestoria-antes-fiscal.dump ./gestoria-antes-fiscal.dump
```

O arquivo de backup deve ficar fora do Git. Conferir o backup e testar sua restauração em outro banco é parte da preparação da equipe. Não remova o volume com `down -v`.

3. Construa a nova imagem, confira a revisão realmente aplicada e leia o preflight:

```powershell
docker compose build api
docker compose run --rm --no-deps api alembic current
docker compose run --rm --no-deps api alembic history
docker compose cp docs/fiscal-preflight.sql db:/tmp/fiscal-preflight.sql
docker compose exec db psql -U gestoria -d gestoria -f /tmp/fiscal-preflight.sql
```

O preflight pressupõe que a tabela fiscal da revisão `0005_fiscal_documents` existe. Em um banco anterior, avance até essa revisão antes de executar o script, dentro da mesma manutenção. Em um banco novo e vazio, o upgrade completo aplica toda a cadeia.

4. Com as inconsistências resolvidas e o backup disponível:

```powershell
docker compose run --rm --no-deps api alembic upgrade head
docker compose run --rm --no-deps api alembic current
docker compose up -d --no-deps api
docker compose logs --tail=100 api
```

A revisão esperada é `0006_fiscal_integrity`. Se o upgrade falhar, mantenha a API parada até entender a causa; não use `alembic stamp` para mascarar a falha. A inicialização normal da aplicação também executa migrations, mas o procedimento separado permite observar a falha antes de abrir a API.

### Testes locais sem Docker

Construa o frontend e instale as dependências de teste do backend:

```powershell
cd frontend
npm ci
npm run lint
npm run build
cd ../backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt -c constraints-tested.txt
python -m pytest -q
```

Sem `TEST_POSTGRES_URL`, testes online de Alembic e concorrência PostgreSQL são ignorados explicitamente. A suíte restante usa SQLite temporário com FKs ativadas. Use apenas um banco PostgreSQL de testes para essa variável; a suíte cria e remove schemas descartáveis.

Smoke adicional do SQL em PostgreSQL/WASM, opcional, a partir de `backend`:

```powershell
python scripts/export_fiscal_migration_sql.py ../.tmp/fiscal-check
npm install --prefix ../.tmp/fiscal-check --no-audit --no-fund @electric-sql/pglite@0.5.8
node scripts/fiscal_migration_smoke.mjs ../.tmp/fiscal-check
```

Esse smoke exercita o SQL real exportado pelo Alembic. Não substitui o PostgreSQL 17 com conexões simultâneas.

## 9. Roteiro de aceitação pela interface

Use dados de demonstração/homologação e credenciais de teste. Os protocolos abaixo devem ser fictícios somente nesse ambiente.

| Caso | Passos | Resultado esperado |
| --- | --- | --- |
| Pedido → saída | Criar pedido protegido com dois produtos; abrir “Notas fiscais”; registrar saída | Cliente, itens e total do pedido aparecem; estoque não cai de novo |
| Dados confiáveis | Alterar preço do produto após criar pedido e depois registrar nota | Nota mantém o preço histórico do pedido |
| Duplicação | Duas abas tentam registrar saída para o mesmo pedido | Só uma ativa; outra recebe conflito |
| Evidência | Tentar autorizar sem data/protocolo; depois informar ambos | Primeira tentativa rejeitada; segunda registra evento/ator |
| Cancelamento | Autorizar e depois cancelar com data, protocolo e motivo | Registro preservado; pedido ainda existe |
| Reemissão | Acionar reemissão após cancelamento | Nova nota exige número novo; antiga continua consultável |
| Exclusão de pedido | Tentar excluir pedido com nota cancelada | Bloqueio para preservar vínculo fiscal |
| Cancelar pedido | Tentar cancelar com nota ativa; depois cancelar nota e repetir | Primeira tentativa bloqueada; segunda repõe o estoque do pedido uma vez |
| Entrada | Cadastrar fornecedor e nota com dois produtos | Estoque inicialmente não muda |
| Recebimento | Autorizar entrada e confirmar recebimento duas vezes | Quantidades somadas uma única vez |
| Estorno | Cancelar entrada recebida | Quantidades estornadas; se estoque insuficiente, tudo é rejeitado |
| Histórico | Conciliar saída antiga com pedido/valor/destinatário compatíveis | Itens recuperados com origem explícita; criador/data desconhecidos continuam nulos |
| Isolamento | Tentar usar pedido/produto/fornecedor de outra empresa pela API | Rejeição, sem criar registro parcial |
| Permissões | Entrar como `member` | Consulta permitida; alterações fiscais bloqueadas |
| Cadastros inativos | Desativar cliente/produto/fornecedor depois de registrar nota | Histórico permanece com os valores capturados |

A tela não oferece exclusão física nem edição livre de valores. Quando houver um conflito com dados alterados por outra pessoa, use “Atualizar” e revise o documento antes de repetir a ação.

## 10. Validação realizada e limites

Resultados automatizados estão em `fiscal-validation-results.json`, `fiscal-validation-junit.xml` e `fiscal-migration-smoke-results.json`.

- Suíte anterior: 115 testes aprovados, 4 ignorados por falta de PostgreSQL online.
- Suíte atual: 139 aprovados e 9 ignorados; os 24 casos adicionais executados cobrem integridade fiscal/API e concorrência SQLite. As cinco novas execuções ignoradas correspondem a três testes de migração online e dois de concorrência PostgreSQL.
- SQL de migrations: sete cenários aprovados em PGlite 0.5.8 / PostgreSQL 18.3 embarcado. Inclui upgrade/downgrade/reupgrade, preservação de históricos, rollback de preflight e restrições de unicidade/FK.
- Frontend: TypeScript e build de produção aprovados (`npm run build`); lint aprovado (`npm run lint`).
- Ruff aprovado nos arquivos fiscais novos/reescritos e respectivos testes/migration/scripts. Não é uma afirmação de limpeza de todo o código legado.
- Não foram executados Docker, PostgreSQL 17 online, navegação manual em navegador ou integração com emissor/SEFAZ neste ambiente. A suíte Docker e o roteiro acima são a etapa de homologação da equipe antes de usar a atualização em produção.

Dois avisos de depreciação da infraestrutura Starlette/httpx/AnyIO persistem; não são falhas de teste. Não foi medido desempenho sob carga. Listagens fiscais ainda não têm paginação e carregam os itens/eventos dos registros retornados, ponto a evoluir se o volume crescer.

Os eventos fiscais são registros transacionais no banco; não recebem uma nova assinatura HMAC nesta atualização. A camada HMAC dos pedidos existente foi preservada. FKs/índices/regras da aplicação não impedem alteração por um administrador com privilégios irrestritos no banco; trilhas externas invioláveis, RLS e assinatura de documentos exigem um escopo adicional.

## Referências técnicas

- [PostgreSQL 17: índices parciais](https://www.postgresql.org/docs/17/indexes-partial.html).
- [PostgreSQL 17: constraints e chaves estrangeiras](https://www.postgresql.org/docs/17/ddl-constraints.html).
- [Alembic: padrões de migração](https://alembic.sqlalchemy.org/en/latest/cookbook.html).
- [PGlite: PostgreSQL embarcado para validação adicional](https://pglite.dev/).
