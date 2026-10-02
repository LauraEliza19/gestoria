# Validação da atualização de segurança

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
