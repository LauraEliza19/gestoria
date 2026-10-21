<div align="center">

# Contribuindo com o GestorIA

### Mudanças pequenas, verificáveis e seguras.

<img alt="Fluxo" src="https://img.shields.io/badge/fluxo-branch%20%2B%20pull%20request-2867E8?style=flat-square" />
<img alt="Qualidade" src="https://img.shields.io/badge/qualidade-testes%20antes%20do%20merge-071225?style=flat-square" />
<img alt="Segurança" src="https://img.shields.io/badge/segurança-por%20padrão-17AEE6?style=flat-square" />

</div>

---

## Antes de começar

1. leia o [README](README.md) e o [índice da documentação](docs/README.md);
2. confirme se já existe uma Issue ou Pull Request para o assunto;
3. defina um escopo pequeno e verificável;
4. nunca use dados reais de clientes nos testes ou capturas;
5. mantenha a mudança compatível com o isolamento por organização.

## Fluxo de trabalho

Atualize a `main` antes de criar sua branch:

```powershell
git switch main
git pull --ff-only origin main
git switch -c tipo/resumo-da-mudanca
```

Prefixos recomendados:

| Prefixo | Uso |
| :--- | :--- |
| `feat/` | nova funcionalidade |
| `fix/` | correção de comportamento |
| `docs/` | documentação |
| `style/` | apresentação ou interface sem mudança de regra |
| `refactor/` | reorganização interna |
| `test/` | cobertura ou infraestrutura de testes |
| `chore/` | manutenção técnica |

Exemplos:

```text
feat/mobile-finance
fix/order-stock-rollback
docs/github-serene-identity
```

## Commits

Use mensagens curtas no imperativo ou presente, com o tipo da mudança:

```text
feat: adiciona resumo financeiro
fix: impede consumo duplicado de estoque
docs: atualiza arquitetura do sistema
style: refina navegação mobile
test: cobre autorização fiscal
```

Evite commits que misturem funcionalidades independentes, formatação em massa e correções não relacionadas.

## Organização do código

```text
backend/    API, serviços, repositórios, modelos, migrations e testes
frontend/   aplicação web React
mobile/     aplicativo Expo/React Native
docs/       decisões, contratos e validações
deploy/     configuração de produção
```

### Backend

- rotas HTTP em `backend/app/api/`;
- contratos em `backend/app/schemas/`;
- regras e transações em `backend/app/services/`;
- consultas e persistência em `backend/app/repositories/`;
- entidades em `backend/app/models/`;
- testes em `backend/tests/`.

Não coloque regra crítica somente na interface ou diretamente no roteador.

### Web

- páginas organizadas por domínio em `frontend/src/pages/`;
- chamadas HTTP em `frontend/src/services/`;
- componentes compartilhados fora das páginas quando houver reutilização real;
- permissão visual não substitui autorização no backend.

### Mobile

- funcionalidades em `mobile/src/features/`;
- rotas em `mobile/src/app/`;
- serviços compartilhados em `mobile/src/services/`;
- identidade visual em `mobile/src/theme/` e `mobile/src/components/serene/`.

Novas telas devem seguir o padrão Sereno: hierarquia clara, poucos elementos simultâneos, estados explícitos e ações principais evidentes.

## Banco de dados

- crie uma migration nova para qualquer alteração de schema;
- nunca reescreva uma migration que já possa ter sido aplicada;
- valide o caminho de atualização e, quando aplicável, o de reversão;
- mantenha chaves estrangeiras e índices coerentes com `organization_id`;
- utilize `Decimal`/`Numeric` para valores monetários;
- trate concorrência em operações de estoque, sessão e confirmação.

Exemplo:

```powershell
docker compose exec api alembic revision --autogenerate -m "descricao da alteracao"
docker compose exec api alembic upgrade head
```

## Verificações obrigatórias

Execute somente as verificações relacionadas ao escopo, além das validações integradas quando a mudança atravessar camadas.

### Backend

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check --no-cache app tests alembic\versions
.\.venv\Scripts\python.exe -m ruff format --check --no-cache app tests alembic\versions
```

### Web

```powershell
cd frontend
npm ci
npm run check
```

### Mobile

```powershell
cd mobile
npm ci
npm run check
```

## Segurança

Toda mudança deve preservar:

- autenticação e renovação de sessão;
- autorização no servidor;
- isolamento entre organizações;
- confirmação e auditoria de ações críticas;
- validação de entrada;
- proteção de segredos;
- integridade transacional;
- respostas sem vazamento de informações internas.

Vulnerabilidades não devem ser publicadas em Issues. Consulte a [política de segurança](SECURITY.md).

## Interface e experiência

Ao alterar web ou mobile:

- inclua carregamento, vazio, erro e sucesso;
- mantenha contraste e áreas de toque adequadas;
- não comunique como funcional uma integração ainda planejada;
- use cor para significado, não apenas decoração;
- acrescente evidências visuais ao Pull Request;
- valide o fluxo em tamanho de tela compatível com o público.

## Pull Request

Antes de abrir o Pull Request:

1. atualize sua branch com a `main`;
2. resolva conflitos conscientemente;
3. execute lint, tipos e testes aplicáveis;
4. revise o diff para remover arquivos locais e mudanças acidentais;
5. preencha o template por completo;
6. descreva riscos, migration e impactos em permissão.

O Pull Request deve ser revisável: objetivo claro, escopo limitado e evidência suficiente para outra pessoa validar a mudança.

## Arquivos que não devem entrar no Git

```text
.env
.env.local
.venv/
node_modules/
dist/
.vscode/
credenciais, tokens, dumps e dados pessoais
```

---

<div align="center">

<strong>Clareza para revisar. Segurança para evoluir.</strong><br />
<sub>GestorIA</sub>

</div>
