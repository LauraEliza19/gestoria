# Validação da atualização de segurança

> **Registro histórico de validação.** Os números e limitações abaixo descrevem
> a execução realizada em 2 de outubro de 2026. Eles devem ser preservados como
> evidência daquela entrega e não representam automaticamente a suíte atual.
> Consulte o [README principal](../README.md), [Sessões seguras](SEGURANCA-SESSOES.md)
> e a [política de segurança](../SECURITY.md) para o estado consolidado.

Data: 02/10/2026.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Backend local, `pytest -q` | **201 aprovados, 14 ignorados** |
| Backend com PostgreSQL descartável | **215 aprovados** |
| Frontend, `npm test` | **19 aprovados** |
| Frontend, `npm run build` | **Aprovado**, TypeScript e Vite |
| Frontend, `npm run lint` | Sem erros; 5 avisos preexistentes em componentes não modificados |
| Migração 0009 em SQLite | Upgrade/downgrade, chaves estrangeiras e unicidade verificados |
| Migração e concorrência no PostgreSQL | Validadas pela suíte executada no Compose de testes |
| Documentação | READMEs e documentos técnicos atualizados para sessões seguras |

Os testes cobrem login por cookie, armazenamento somente do hash, recusa de Bearer, cookie seguro/persistência, rotação, limite absoluto, revogação, logout de todas as sessões, conta/vínculo desativados, CSRF, normalização de e-mail, 429/Retry-After, recuperação da janela de rate limiting, cabeçalhos em respostas de sucesso/erro/500 e recusa de configuração produtiva insegura.

Há testes concorrentes para garantir um vencedor por renovação e contadores de login compartilhados entre conexões. O cliente tem testes de renovação única para requisições paralelas, repetição limitada, falha temporária de renovação, confirmação de logout no servidor e envio da opção “Manter conectado”. A suíte existente também verifica operações fiscais, pedidos, estoque, produção e isolamento entre empresas.

## Limites reais desta verificação

- A suíte completa foi executada em PostgreSQL descartável no dia 02/10/2026, com 215 testes aprovados. Isso valida migrations e concorrência no PostgreSQL, mas não substitui a homologação na infraestrutura definitiva nem os testes de backup e restauração.
- Não foi possível executar um navegador real: o Chromium não estava disponível e o download não concluiu. O frontend foi compilado e seus serviços foram testados em Node com respostas HTTP simuladas; isso não constitui um teste visual ou E2E no navegador.
- O Compose de produção e o proxy HTTPS não foram executados neste ambiente. O Compose descartável de testes foi validado, mas emissão do certificado, DNS, portas e cabeçalhos encaminhados ainda precisam de validação no servidor real.
- Nenhuma implantação externa ou alteração em banco de produção foi realizada. Nenhuma credencial de produção foi criada ou incluída no pacote.

## Como reproduzir

Suite completa com PostgreSQL descartável:

```bash
docker compose -p gestoria-security-validation -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p gestoria-security-validation -f docker-compose.test.yml down --remove-orphans
```

Frontend:

```bash
cd frontend
npm ci
npm test
npm run build
npm run lint
```

Backend local (após compilar o frontend, a partir da pasta `backend`):

```bash
python -m pip install -r requirements-dev.txt -c constraints-tested.txt
python -m pytest -q
```

Use `docs/SEGURANCA-SESSOES.md` para configurar produção, aplicar a migração e cadastrar o administrador real. Credenciais demo antigas deixaram de ser um caminho de acesso produtivo.

---

## Gateway Seguro do Copiloto — 26/10/2026

Esta seção descreve a validação desta entrega e não altera o registro histórico de 02/10/2026 acima.

### Base e escopo

Base recebida: `gestoria-main(3).zip`. A cadeia Alembic terminava em `0013_finance_entry_versions`, posterior ao merge `2bde4cefcdec`. Foi acrescentada a migration `0014_copilot_security_gateway`, filha direta de `0013_finance_entry_versions`, criando `copilot_tool_audit_logs` e `copilot_rate_limits` e preservando uma única head.

| Requisito | Implementação e evidência |
| --- | --- |
| Provedor abstrato | `CopilotAIProvider`/`LocalCopilotProvider`, DTOs mínimos e substituição por `MockCopilotProvider` via dependência FastAPI |
| Segredos no backend | `SecretStr` em Settings; `.env.*.example` e Compose somente da API; nenhum segredo/contexto de banco fornecido ao provedor |
| Rate limiting | UPSERT atômico por empresa/usuário, janela configurável, 429 e `Retry-After`; sem leitura de pedidos nem chamada ao provedor após esgotamento |
| Isolamento de empresa | IDs exclusivamente da sessão; filtro de organização em pedidos, clientes e leitura de auditoria; orçamento separado por usuário e empresa |
| Ferramentas fechadas | Registro imutável das dez intenções, schemas de argumentos/saída, nenhuma SQL/reflexão/callback fornecida ao provedor |
| Auditoria | Sucesso, negativa, limite e erro persistidos; rollback antes de auditar erro; falha de auditoria bloqueia resultado; FK composta de vínculo e proteção de downgrade |
| Gestão Interna | Papel `owner`/`admin` antes de todas as seis operações; negativas auditadas; IDs de outra empresa retornam 404; schemas e regras existentes preservados |

As consultas internas de Gestão Interna já filtravam organização e já possuíam FKs compostas. Foram mantidas. A autorização HTTP repetida foi centralizada em `require_employee_record_access`, preservando a verificação antes de qualquer busca e acrescentando auditoria das negativas. Os testes existentes de services/repositories continuam verificando as regras de estado e integridade dessa camada interna.

Mudança intencional de contrato: perguntas restritas do Copiloto retornam **403**, em lugar da orientação anterior com HTTP 200. As intenções restritas são `active_employees`, `cost_centers_summary` e `sales_today`. O formato das respostas de sucesso foi preservado; não houve alteração de fonte em `frontend/` ou `mobile/`.

### Resultados desta execução

| Verificação | Resultado |
| --- | --- |
| Base original, pytest local | 315 aprovados, 16 ignorados por dependerem de PostgreSQL |
| Suíte focada do gateway/registros/migration, sem PostgreSQL | 96 aprovados, 2 dependentes de PostgreSQL ignorados |
| Suíte completa local após alterações | 387 aprovados, 18 dependentes de PostgreSQL ignorados |
| Suíte completa com PostgreSQL 17 descartável | **405 aprovados; zero falhas; zero ignorados** (PostgreSQL 17.11) |
| Ruff, `check` | Aprovado em `app`, `tests`, `alembic/versions` |
| Ruff, `format --check` | 147 arquivos formatados corretamente |
| Alembic, `heads` | Uma única head: `0014_copilot_security_gateway` |
| Frontend, `npm test` | Aprovado |
| Frontend, `npm run typecheck` | Aprovado |
| Frontend, `npm run build` | Aprovado |
| Frontend, `npm run lint` | Sem erros; avisos preexistentes de React em componentes não modificados |

A suíte ganhou 74 casos em relação à base recebida, incluindo parametrizações de papel, tipo de registro, operação e banco. Os testes existentes foram mantidos; a expectativa antiga de 200 em pergunta restrita foi atualizada para o 403 exigido nesta entrega.

O ZIP original tinha 11 apontamentos de Ruff e sete arquivos com formatação pendente, principalmente no Financeiro e nas migrations recentes. Foram corrigidos imports, ordenação de `__all__`, anotações equivalentes e formatação, sem mudar regras financeiras nem o comportamento das migrations existentes. A equivalência dos corpos do código financeiro e das migrations 0012/0013 foi conferida também por comparação de AST, desconsiderando ordenação de imports. Nenhuma dependência de aplicação foi adicionada.

### Cobertura dos novos testes

- Usuário A pedindo dados de B por mensagem, cabeçalho, parâmetro ou corpo; corpo com campos extras é rejeitado, os demais não substituem a sessão.
- Vínculo legado inconsistente entre pedido de A e cliente de B sem revelar o cliente estrangeiro.
- Papel `member` bloqueado antes de consultas/provedor em todas as ferramentas restritas.
- Todas as seis operações de `EmployeeRecord`, para advertências, ocorrências, reconhecimentos e observações, bloqueadas para membros e auditadas como `denied`.
- Todas as operações de registros permitidas a administrador e bloqueadas diante de IDs de outra empresa, mantendo o registro original intacto.
- Estouro sequencial do orçamento, `Retry-After`, reabertura da janela e separação de usuários/empresas, inclusive o mesmo usuário vinculado a duas empresas.
- Requisições concorrentes em conexões distintas: apenas duas de cinco passam quando o limite é dois.
- Provedor recebendo somente DTO Pydantic de intenção/contagem, sem Session, models, prompt livre, nomes ou credencial.
- Respostas extras, vazias, com chave configurada ou exceção contendo a chave recusadas com mensagem genérica e auditoria de erro.
- Falha real de FK durante a consulta, rollback da transação, auditoria de erro persistida e ausência do dado inválido no banco.
- Auditoria validada, lida com filtro de organização e protegida contra usuário sem vínculo na empresa.
- Migration criando colunas, índices e constraints; upgrade/downgrade vazio; bloqueio de downgrade com histórico e upgrade a partir da head anterior.

Os testes de concorrência em SQLite usam banco em arquivo com conexões distintas; os cenários de PostgreSQL usam schemas descartáveis. Os testes tradicionais de API continuam usando os fixtures SQLite existentes. Configurar `TEST_POSTGRES_URL` habilita as verificações online; não transforma todos os fixtures de API em PostgreSQL.

### Como reproduzir

No Docker, execute a partir da raiz do projeto. O Compose de testes já usa PostgreSQL 17 em banco descartável, sem volumes de produção:

```bash
docker compose -p gestoria-copilot-tests -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p gestoria-copilot-tests -f docker-compose.test.yml down --remove-orphans
```

Para a execução local, instale as dependências e compile primeiro o frontend, necessário para importar a aplicação nos testes:

```bash
cd frontend
npm ci
npm run build
npm test
npm run lint
npm run typecheck
cd ../backend
python -m pip install -r requirements-dev.txt -c constraints-tested.txt
python -m pytest -q
python -m ruff check --no-cache app tests alembic/versions
python -m ruff format --check --no-cache app tests alembic/versions
python -m alembic heads
```

Para habilitar testes PostgreSQL fora do Docker, configure `TEST_POSTGRES_URL` para um banco **de testes**, com permissão de criar/remover schemas, antes de executar pytest. Não usar credenciais nem endereço de produção. Os cenários online criam e removem schemas isolados.

Para conferir e aplicar a migration no ambiente de homologação, após backup e com a configuração correta da API:

```bash
cd backend
python -m alembic current
python -m alembic heads
python -m alembic upgrade head
python -m alembic current
```

`current` informa o que foi aplicado naquele banco; `heads` mostra a última revisão presente nos arquivos. O startup dos Composes da API já executa `alembic upgrade head`. O downgrade com eventos de auditoria é deliberadamente bloqueado; preservar o histórico e o backup no plano de reversão.

### Limites reais

- O provedor implementado é local e determinístico; nenhuma integração HTTP com IA externa foi criada, nem dados enviados a terceiros.
- A infraestrutura definitiva, o proxy HTTPS, backup/restauração e o Compose completo de produção não foram executados nesta sessão. A validação de banco utiliza PostgreSQL descartável e não modifica dados de produção.
- O frontend foi compilado e teve os testes existentes executados; isso não equivale a teste visual/E2E no navegador nem a execução do aplicativo mobile.
- Persistência de auditoria depende da disponibilidade do banco. Falhas de armazenamento retornam 503 sem entregar sucesso; nenhuma mensagem de exceção ou credencial é devolvida.
- Os testes emitem um aviso preexistente de configuração Alembic (`path_separator`), sem falha. O build do frontend mantém o aviso de bundle acima de 500 kB.
