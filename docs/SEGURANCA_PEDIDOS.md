# GestorIA - Atualizações, especificação e teste/uso

Versão: 0.2.0-security.1 | Data: 08/09/2026 | Base: último gestoria-main.zip enviado nesta conversa, com Radar e Copiloto.

## 1. Entrega e alcance

Foi implementada uma primeira camada de integridade e autenticidade para a criação direta de pedidos. O backend prepara uma proposta com os dados exatos, gera um HMAC-SHA256 e só executa a confirmação correspondente. A mesma operação pode ser repetida após falha de conexão sem criar outro pedido ou baixar o estoque novamente.

Esta versão é uma implementação para testes, com validação automatizada local. Não foi implantada no computador da equipe nem em um servidor de produção. A base é o ZIP recebido; alterações posteriores da equipe que não estejam nesse ZIP precisam ser conciliadas antes de atualizar o projeto principal.

A integração preservou as novidades do ZIP atualizado: Radar operacional, indicadores reais, ações rápidas, página /copiloto, ajustes nas transições de status e seus testes. O atalho Novo pedido do Radar passa pela mesma confirmação protegida. Após confirmar ou recuperar um pedido, a interface recarrega pedidos, clientes e estoque e atualiza o Radar. O Copiloto recebido contém a estrutura visual, mas ainda não possui um fluxo de IA que execute essas operações.

| Recurso | Implementação entregue |
| --- | --- |
| Proposta assinada | HMAC-SHA256 sobre contexto, dados, validade, nonce, hashes e identificação da chave |
| Confirmação | Usuário e empresa vinculados à proposta; conteúdo conferido contra a cópia persistida |
| Repetição | Idempotência na preparação e confirmação, inclusive com acessos simultâneos |
| Persistência | Pedido, estoque, comprovante e evento de execução na mesma transação |
| Auditoria | Eventos prepared, executed, rejected e cancelled persistidos e autenticados |
| Interface | Revisão dos valores do servidor, descarte da proposta, recuperação pendente e download do último comprovante |
| Configuração | Gerador de chave local, chaveiro com key_id e suporte à rotação mantendo chaves anteriores |
| Testes | Casos funcionais, adulteração, isolamento, expiração, concorrência, rollback e migrations PostgreSQL |

A rota antiga POST /api/orders agora responde 428. Não existe configuração para reabrir essa criação direta sem proposta. A conversão de orçamentos conserva seu fluxo anterior de aprovação e conversão única; ela ainda não gera estes envelopes/comprovantes. Portanto, esta entrega NÃO significa que todas as operações do GestorIA estejam cobertas pela nova camada.

## 2. Instalação para teste no Windows/Docker

Extraia o ZIP em uma pasta de teste. Abra o PowerShell nessa pasta, onde está docker-compose.yml. O projeto de teste abaixo usa outro nome de Compose, outro volume e portas alternativas, permitindo manter o projeto atual rodando.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
$env:API_PORT = "8001"
$env:POSTGRES_PORT = "5433"
docker compose -p gestoria-security-preview run --rm security-init
docker compose -p gestoria-security-preview up -d --build
docker compose -p gestoria-security-preview ps
```

Abra http://localhost:8001 e http://localhost:8001/docs. Com os valores padrão do ambiente de demonstração: e-mail admin@gestoria.dev e senha GestorIA@123. Se o .env definir outras credenciais, use essas credenciais. O banco da cópia de teste começa separado do banco atual; seus registros antigos não aparecerão automaticamente nele.

O serviço security-init gera uma chave aleatória de 32 bytes e grava o chaveiro no .env. Não imprime a chave. Preserva configurações já existentes. É um serviço auxiliar com profile tools; não permanece executando junto da aplicação. Sem chave configurada, as operações protegidas retornam 503.

Na inicialização da API, Alembic aplica a migration 0004_protected_orders, posterior a e8559033a8ca. Ela adiciona order_operations e order_audit_events. Não remove nem reescreve os pedidos existentes. As quantidades fracionárias já eram suportadas pela migration anterior; a nova migration não altera essas colunas.

Para acompanhar problemas de inicialização:

```powershell
docker compose -p gestoria-security-preview logs --tail 100 api
```

Para parar a cópia de teste e limpar apenas as variáveis desta sessão do PowerShell:

```powershell
docker compose -p gestoria-security-preview down
Remove-Item Env:API_PORT, Env:POSTGRES_PORT
```

O comando down acima preserva o volume do banco. Não use down -v se quiser conservar os dados. Ao integrar no projeto principal, preserve o .env e atualize backend e frontend juntos: o frontend antigo ainda chama a rota que agora retorna 428.

## 3. Uso pela interface

1. Faça login e cadastre um cliente e um produto. Para o roteiro, use preço R$ 12,50 e estoque 10.
2. Entre em Pedidos, clique em Novo pedido, selecione o cliente/produto e informe quantidade 2.
3. Clique em Revisar pedido. A API prepara a proposta; nenhum pedido foi gravado e o estoque continua 10.
4. Confira cliente, produto, quantidade, preço unitário, total R$ 25,00 e validade apresentados pelo servidor.
5. Clique em Confirmar pedido. O pedido é registrado e o estoque passa a 8.
6. Em Pedidos, clique em Baixar último comprovante de pedido. O arquivo JSON contém os hashes, o resultado histórico e o HMAC verificado pelo backend.

Repita o roteiro pelo atalho Novo pedido da Visão geral. A revisão deve ser a mesma e, após a confirmação, o Radar deve refletir o pedido em produção e o novo estoque. Confira também se /copiloto continua abrindo e se as opções de mudança de status preservam as regras da versão enviada.

Descartar revisão cancela a proposta no servidor. Ela não poderá ser confirmada depois. Pressionar Escape apenas fecha a janela e mantém a proposta pendente para recuperação; ao revisar novamente, a proposta anterior pode ser retomada. O texto da revisão informa quando isso acontece.

Se a resposta de confirmação se perder, tente novamente com a mesma revisão. O servidor retorna o pedido original. O navegador guarda somente a referência da proposta e os identificadores/dados da solicitação em sessionStorage para recuperação na mesma aba, inclusive após recarregar a página. A referência é conferida contra o usuário autenticado; outra pessoa/empresa não pode utilizá-la.

O comprovante representa o estado ORIGINAL da criação. Se o pedido for concluído, cancelado ou excluído posteriormente, o comprovante e a resposta de repetição permanecem históricos. Para ver o estado atual, consulte a listagem de pedidos. Fechar a aba encerra a recuperação local por sessionStorage; os registros continuam no servidor.

## 4. Contrato da API

As rotas exigem Authorization: Bearer <token>. O tenant é determinado pela sessão autenticada, não por um organization_id enviado no formulário de criação. A documentação interativa agrupa as novas rotas em protected orders.

| Método e rota | Entrada e resultado |
| --- | --- |
| POST /api/orders/proposals | Header Idempotency-Key com UUID; corpo OrderCreate; retorna 201 com operation_id, status e envelope |
| GET /api/orders/proposals/{id} | Recupera a proposta do próprio usuário/empresa e verifica sua integridade |
| POST /api/orders/proposals/{id}/confirm | Corpo {"envelope": ...}; 201 na primeira execução ou 200 em repetição já concluída |
| POST /api/orders/proposals/{id}/cancel | Cancela uma proposta pendente; 204, inclusive em repetição do cancelamento |
| GET /api/orders/proposals/{id}/receipt | Retorna verified e receipt; falha se a operação não foi executada ou se houver adulteração |
| GET /api/orders/security/events?limit=30 | Últimos eventos da empresa para owner/admin; somente próprios eventos para member; limite máximo 100 |
| POST /api/orders | Rota anterior bloqueada com 428 para criação direta |

Exemplo de solicitação de proposta; substitua os UUIDs pelos registros do ambiente:

```json
{
  "customer_id": "UUID_DO_CLIENTE",
  "items": [
    {"product_id": "UUID_DO_PRODUTO", "quantity": "2.000"}
  ]
}
```

O envelope devolvido contém schema_version, action, operation_id, organization_id, actor_id, idempotency_key, nonce, issued_at, expires_at, payload, input_hash, key_id, algorithm e signature. Retorne esse envelope inteiro na confirmação, sem recriar os dados a partir da tela. O cliente não calcula o HMAC e nunca recebe a chave.

O HMAC cobre todos os campos do envelope, exceto o próprio campo signature. input_hash é SHA-256 da proposta de negócio normalizada. O comprovante inclui result e output_hash, correspondente ao resultado persistido. Os hashes de entrada e saída não precisam coincidir: são documentos diferentes, vinculados pela operação.

A confirmação inclui os headers X-Operation-ID e X-Idempotent-Replay. Erros de domínio usam X-Error-Code com um código estável e detail com mensagem legível. Nas rotas protegidas que retornam dados, respostas bem-sucedidas usam Cache-Control: no-store.

| Status | Significado principal |
| --- | --- |
| 401 | Sessão inválida, usuário inativo ou vínculo revogado |
| 403 | Assinatura alterada, contexto inválido ou operação não permitida |
| 404 | Recurso/proposta não encontrado dentro do escopo autorizado |
| 409 | Mesma chave com outros dados, preço/cadastro alterado, estoque insuficiente ou integridade do comprovante comprometida |
| 410 | Proposta expirada ou cancelada |
| 422 | Contrato inválido, campo extra, Idempotency-Key ausente/inválido ou limites excedidos |
| 428 | Tentativa de usar a criação direta antiga |
| 503 | Chave ativa/histórica ausente ou configuração criptográfica inválida |

## 5. Regras e garantias implementadas

As permissões de criação permanecem owner, admin e member, como no fluxo anterior. A nova função central de autorização reconsulta usuário e vínculo no momento da operação. No PostgreSQL, bloqueios compartilhados mantêm esses registros estáveis até o fim da transação. Isso permite reutilizar a política quando o orquestrador real de IA for integrado.

Antes de confirmar, o backend confere assinatura, cópia persistida, usuário, empresa, ação, identificador, validade e hash. Depois obtém a operação por uma atualização condicional de pending para processing. A alteração só é confirmada junto com pedido, estoque, comprovante e evento executed. Pedidos disputando produtos bloqueiam as linhas em ordem de ID. O prazo é conferido novamente após a aquisição do bloqueio da operação.

Cliente e produtos precisam continuar ativos e pertencentes à empresa. Nome, unidade e preço apresentados na proposta precisam continuar iguais; mudanças geram nova revisão. O estoque não fica reservado na preparação e precisa ser suficiente na confirmação. Valores monetários são arredondados a duas casas com ROUND_HALF_UP, inclusive em quantidades fracionárias. Há uma conferência final do total persistido contra o aprovado.

A idempotência da preparação é única por empresa, usuário e chave. Itens repetidos são agrupados, ordenados e normalizados para calcular o request_hash. Repetir a mesma chave e os mesmos dados recupera a proposta. Reutilizá-la com dados diferentes retorna conflito. Cada solicitação aceita até 100 linhas; a quantidade acumulada de um produto não pode ultrapassar 1.000.000.

Repetições de uma operação já executada retornam o mesmo resultado, mesmo após expirar a proposta ou depois de excluir o pedido. A assinatura e a sessão continuam sendo verificadas. Uma chave nova representa outra intenção e pode produzir outro pedido; a camada não impede duplicidades de negócio feitas com chaves diferentes.

Eventos de preparação, execução e cancelamento são gravados transacionalmente. Rejeições de confirmação de propostas pertencentes ao próprio usuário são registradas após o rollback. Falhas de autenticação, contratos rejeitados antes da rota e tentativas de outros tenants não são todas registradas nesta tabela. Não são gravados tokens, senhas ou o conteúdo adulterado recebido do cliente.

## 6. Testes automatizados e teste HTTP

Para executar a suíte com PostgreSQL 17 em banco descartável, separado do desenvolvimento:

```powershell
docker compose -f docker-compose.test.yml -p gestoria-security-test `
  up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.test.yml -p gestoria-security-test down
```

O serviço tests instala as dependências fixadas em constraints-tested.txt, executa pytest e fornece TEST_POSTGRES_URL. Os testes PostgreSQL criam schemas de nomes aleatórios e os removem ao terminar. O banco usa tmpfs e não publica porta no host. O teste de migrations aplica toda a cadeia, retorna até e8559033a8ca e reaplica a nova migration dentro do schema descartável.

Para testar por HTTP a API que está rodando na cópia de demonstração:

```powershell
docker compose -p gestoria-security-preview exec api python scripts/security_smoke.py --cleanup
```

Digite a senha do usuário de teste quando solicitado. O script usa DEMO_EMAIL, ou aceita --email. Ele cria registros com nomes exclusivos, prepara e repete propostas, testa conflitos e adulteração, confirma duas vezes, verifica estoque e comprovante. Com --cleanup remove somente seus registros de negócio; a auditoria permanece. Sem --cleanup, os registros permanecem para inspeção na interface. É necessário owner/admin para a limpeza.

O script opera no servidor informado por --base-url; o padrão é localhost:8000 dentro do container. Use somente em ambiente de teste. Não é um scanner e não executa testes contra serviços externos.

Para medir as rotas em uma base SQLite isolada:

```powershell
docker compose -f docker-compose.test.yml -p gestoria-security-test `
  run --rm --no-deps tests python scripts/benchmark_order_protection.py --iterations 50
```

| Cenário | Critério de aceitação |
| --- | --- |
| Preparar e confirmar | Estoque não muda na preparação; muda uma vez na confirmação |
| Alterar quantidade/preço/empresa/assinatura | HTTP 403; nenhum pedido nem baixa de estoque |
| Recalcular só SHA-256 após adulterar | HMAC continua inválido; operação rejeitada |
| Repetir a mesma confirmação | Mesmo ID/resultado; segunda resposta HTTP 200 |
| Seis confirmações simultâneas | Um pedido, uma baixa, um evento executed |
| Preparações simultâneas com a mesma chave | Uma única operação persistida |
| Dois pedidos disputam a última unidade | Um sucesso, um conflito, estoque nunca negativo |
| Outra pessoa ou empresa usa a proposta | HTTP 404, sem acesso à proposta/comprovante |
| Revogar o vínculo após preparar | Confirmação bloqueada |
| Alterar preço ou estoque após preparar | Nova revisão ou conflito, sem escrita parcial |
| Expirar ou descartar a proposta | HTTP 410 ao confirmar |
| Falhar a gravação da auditoria | Rollback; sem pedido/baixa ou proposta órfã |
| Alterar comprovante/histórico no banco | Integridade sinalizada como inválida |
| Rotacionar mantendo chave anterior | Proposta antiga aceita; comprovante assinado pela chave nova |
| Remover chave ou deixá-la vazia | Falha fechada HTTP 503, sem fallback |

Para uma checagem manual de expiração, configure OPERATION_TTL_SECONDS=30, recrie a API, prepare uma proposta, aguarde mais de 30 segundos e confirme. Restaure o padrão 300 depois. Os testes automatizados usam relógio controlado e não precisam aguardar cinco minutos.

## 7. Resultados obtidos nesta entrega

Resultado da suíte local sobre o ZIP atualizado: **115 aprovados, 4 ignorados por falta de PostgreSQL, 0 falhas**. Os quatro pendentes são três cenários de concorrência no PostgreSQL e o teste de migrations nesse banco. Os equivalentes de concorrência passaram em SQLite com arquivo, conexões separadas e WAL. Os testes funcionais da suíte anterior e o novo teste da página do Copiloto também passaram.

O script security_smoke.py foi executado por HTTP contra a aplicação integrada, com autenticação real e banco SQLite temporário. Preparação, conflito, adulteração, confirmação, repetição, estoque, comprovante e limpeza passaram. O gerador de configuração também foi verificado: criou uma chave aleatória de 32 bytes, preservou outros campos e manteve a mesma chave na segunda execução.

A cadeia Alembic foi gerada em SQL para o dialeto PostgreSQL sem erros. Isso não substitui executar as migrations em um servidor PostgreSQL. Docker não está disponível neste ambiente. Foram verificados sintaxe Python/JavaScript, imports e lint dos arquivos novos/alterados selecionados. A dependência Starlette emitiu avisos de depreciação durante os testes; não houve falhas decorrentes deles.

O navegador remoto bloqueou o acesso ao servidor local de teste. Por isso, a revisão visual/interativa do frontend permanece pendente; não foi declarada como aprovada. O roteiro da seção 3 deve ser executado pela equipe.

Medição da implementação integrada: 50 operações, após 5 aquecimentos, Python 3.12.14/Linux, ASGI TestClient e SQLite em memória, um item por pedido. Inclui API, autenticação, banco e auditoria; exclui rede, PostgreSQL, provedor de IA e tempo humano. Não é comparação com a versão anterior.

| Etapa | p50 (ms) | p95 (ms) |
| --- | --- | --- |
| Preparação | 4,587 | 6,640 |
| Primeira confirmação | 6,933 | 9,028 |
| Repetição da confirmação | 3,136 | 3,943 |

O fluxo acrescenta uma requisição de preparação e a revisão humana. Os números acima não são promessa de latência de produção nem medição isolada do custo de HMAC. A equipe deve medir p95/p99, CPU, contenção e armazenamento no PostgreSQL e na rede de implantação. Detalhes reproduzíveis estão em validation-results.json e benchmark-results.json, nesta pasta.

## 8. Chaves, limites e próximos passos

OPERATION_SIGNING_KEYS é um objeto JSON de key_id para chave hexadecimal de 64 caracteres. OPERATION_ACTIVE_KEY_ID seleciona a chave usada para assinar novos documentos. OPERATION_TTL_SECONDS define a validade (30 a 3600 segundos; padrão 300). A chave de operações é independente de JWT_SECRET.

Para rotacionar, adicione uma chave aleatória nova ao chaveiro, mantenha as antigas necessárias para verificar propostas/comprovantes e altere o key_id ativo. Recrie a API para carregar a configuração. Remover uma chave antiga impede verificações históricas correspondentes. Proteja e faça backup da configuração; ela não acompanha o ZIP entregue. O gerador não substitui uma chave existente automaticamente.

O formato de assinatura é um contrato interno versionado. Usa JSON com chaves ordenadas, UTF-8, separadores compactos e rejeição de NaN; UUIDs, datas e decimais são strings. Não implementa RFC 8785 nem HTTP Message Signatures. O cliente devolve o documento emitido pelo servidor, portanto não precisa reproduzir a serialização. Os prefixos order-plan, order-receipt e order-audit separam os usos do HMAC.

HMAC não criptografa o JSON. HTTPS, proteção das sessões, autorização, validação e defesa contra XSS continuam necessários. Quem controla a chave pode produzir documentos válidos. A assinatura não comprova que uma pessoa leu a tela, não impede um cliente autorizado de preparar e confirmar por código e não garante que uma IA interpretou corretamente uma intenção.

Os eventos têm adulterações detectáveis enquanto as chaves e referências confiáveis estiverem protegidas. Não há armazenamento imutável, encadeamento de hashes nem checkpoint externo nesta versão. Apagar registros inteiros ou comprometer simultaneamente banco e chaves não é resolvido por esta entrega. HMAC é verificável por detentores da chave; o download não fornece uma assinatura pública independente como Ed25519.

A auditoria da nova API não foi incorporada ao histórico visual antigo, que continua local para outras ações. O download do último comprovante depende da referência da sessão/aba. As propostas e eventos permanecem no banco; expiração não significa exclusão automática. Retenção, limpeza e limites de frequência devem ser definidos antes de exposição pública.

Continuam fora do escopo: integração real com IA, RLS, MFA, migração da sessão para cookies, endurecimento geral da implantação e assinatura de conversões de orçamento/outros módulos. Os valores padrão de JWT e credenciais demo do ambiente original continuam sendo apenas para desenvolvimento. O próximo gate é executar o Compose de testes com PostgreSQL e validar a interface antes de integrar no ambiente principal.

## 9. Arquivos e referências técnicas

Principais arquivos novos: app/operation_crypto.py, app/services/order_operations.py, app/api/order_operations.py, app/models/order_operation.py, schemas/order_operation.py, migration 0004_protected_order_operations.py, protected-orders.js, scripts de configuração/teste/medição e docker-compose.test.yml. Os caminhos app e schemas acima são relativos a backend; o módulo JavaScript fica em frontend/static/js/models.

Arquivos existentes ajustados: criação de pedidos, serialização compartilhada, arredondamento monetário, schemas, carregamento de rotas/configuração, tela de pedidos, apiFetch, Dockerfiles, Compose, README e testes anteriores que passaram a usar preparação/confirmação. constraints-tested.txt fixa as versões Python efetivamente usadas na validação. A estrutura geral de FastAPI, SQLAlchemy, Alembic e PostgreSQL foi preservada.

Referências do desenho, sem alegação de implementação integral dos padrões:

- RFC 2104 - HMAC: https://datatracker.ietf.org/doc/html/rfc2104
- OWASP - Transaction Authorization: https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html
- OWASP - Logging: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- PostgreSQL 17 - Transaction Isolation: https://www.postgresql.org/docs/17/transaction-iso.html
