# Copiloto GestorIA — contrato do MVP controlado

## 1. Objetivo

O primeiro MVP do Copiloto oferece uma conversa orientada para consultas empresariais.

Nesta etapa, o Copiloto não utiliza um provedor externo de inteligência artificial. As intenções são reconhecidas de forma controlada e somente ferramentas autorizadas podem consultar dados reais.

A primeira ferramenta real é a consulta de pedidos em preparo. As demais perguntas recebem respostas orientativas e atalhos para os módulos correspondentes, sem inventar informações.

## 2. Limites

O Copiloto:

- utiliza apenas a empresa da sessão autenticada;
- não recebe um `organization_id` escolhido pelo cliente;
- não acessa diretamente outras empresas;
- não executa alterações sem confirmação explícita;
- não inventa valores quando uma ferramenta ainda não existe;
- não expõe segredos, senhas, cookies ou configurações internas;
- não retorna salários, documentos pessoais ou dados restritos sem permissão;
- não substitui os fluxos manuais dos módulos;
- não representa aconselhamento fiscal, contábil ou jurídico;
- não envia dados a provedores externos neste MVP.

## 3. Dez perguntas reais mapeadas

| Nº | Pergunta do empresário | Intenção | Situação no MVP | Ação sugerida |
| --- | --- | --- | --- | --- |
| 1 | O que precisa da minha atenção hoje? | `daily_priorities` | Resposta controlada | Abrir visão geral |
| 2 | Quais pedidos estão em produção? | `orders_in_preparation` | Ferramenta real | Abrir pedidos |
| 3 | Quais produtos estão com estoque crítico? | `critical_stock` | Resposta controlada | Abrir produtos |
| 4 | Quais orçamentos precisam de acompanhamento? | `quotes_follow_up` | Resposta controlada | Abrir orçamentos |
| 5 | Quais notas fiscais exigem atenção? | `fiscal_attention` | Resposta controlada | Abrir notas fiscais |
| 6 | O que posso produzir com o estoque atual? | `production_availability` | Resposta controlada | Abrir modo produção |
| 7 | Quanto vendemos hoje? | `sales_today` | Resposta controlada e restrita | Abrir visão geral |
| 8 | Quais são os nossos principais clientes? | `top_customers` | Resposta controlada | Abrir clientes |
| 9 | Quantos funcionários ativos temos? | `active_employees` | Resposta controlada e restrita | Abrir funcionários |
| 10 | Como estão distribuídos os centros de custo? | `cost_centers_summary` | Resposta controlada e restrita | Abrir centros de custo |

Perguntas não reconhecidas utilizam a intenção `unknown`.

## 4. Contexto permitido

O contexto interno do gateway pode conter somente:

- identificador e nome da empresa autenticada;
- identificador, nome e papel do usuário autenticado;
- data e hora da solicitação;
- mensagem enviada pelo usuário;
- intenção reconhecida;
- resultado estritamente necessário da ferramenta autorizada;
- permissões necessárias para apresentar ações;
- identificadores necessários para criar links internos.

O provedor recebe um contexto ainda menor: somente `intent` e, na consulta de pedidos, `order_count`. Nome/ID da empresa, usuário, mensagem original, clientes, pedidos e credenciais não são enviados ao provedor.

Não entram no contexto do provedor:

- senhas;
- cookies;
- tokens ou chaves;
- configurações e segredos do servidor;
- dados de outras empresas;
- tabelas completas;
- salários ou documentos pessoais sem autorização;
- informações que não sejam necessárias para responder à pergunta.

## 5. Contrato HTTP

### Solicitação

`POST /api/copilot/chat`

```json
{
  "message": "Quais pedidos estão em produção?"
}
```

Regras:

- autenticação obrigatória;
- proteção CSRF obrigatória;
- mensagem entre 1 e 500 caracteres;
- espaços externos são removidos;
- a organização sempre vem da sessão.

### Resposta

```json
{
  "message_id": "uuid",
  "status": "answered",
  "intent": "orders_in_preparation",
  "message": "Existem 2 pedidos em preparo.",
  "tool": {
    "name": "orders_in_preparation",
    "status": "success"
  },
  "items": [
    {
      "id": "uuid-do-pedido",
      "title": "Cliente Exemplo",
      "description": "Pedido ABC12345 · R$ 120,00",
      "path": "/pedidos"
    }
  ],
  "actions": [
    {
      "id": "open-orders",
      "label": "Abrir pedidos",
      "path": "/pedidos",
      "requires_confirmation": false
    }
  ],
  "confirmation": null,
  "generated_at": "2026-10-19T12:00:00Z"
}
```

Valores possíveis de `status`:

- `answered`: uma ferramenta real respondeu;
- `guided`: resposta controlada com orientação e ação sugerida;
- `confirmation_required`: a solicitação envolve uma ação que exigiria confirmação.

Valores possíveis para `tool.status`:

- `success`;
- `empty`;
- `error`.

## 6. Primeira ferramenta real

Nome: `orders_in_preparation`

Responsabilidade:

- consultar somente pedidos da empresa autenticada;
- selecionar pedidos com status `in_preparation`;
- ordenar pelos mais recentes;
- retornar no máximo cinco pedidos;
- informar a quantidade total encontrada;
- retornar somente identificador, cliente, valor, data e link interno;
- nunca alterar pedidos ou estoque.

Quando não houver pedidos, a resposta continua com status `answered`, a ferramenta retorna `empty` e a mensagem informa que não há pedidos em preparo.

## 7. Respostas controladas

Quando uma intenção estiver mapeada, mas ainda não possuir ferramenta:

- responder com status `guided`;
- explicar que a consulta automática ainda não está disponível;
- nunca criar números ou resultados fictícios;
- oferecer um atalho para o módulo correto;
- manter a conversa utilizável.

Quando a pergunta não for reconhecida:

- usar a intenção `unknown`;
- informar quais assuntos estão disponíveis;
- apresentar sugestões de perguntas;
- não tratar a pergunta como erro técnico.

## 8. Fluxo de conversa

### Sucesso

1. Usuário envia a pergunta.
2. Interface exibe estado de envio.
3. Backend reconhece a intenção.
4. Ferramenta autorizada consulta os dados da empresa.
5. Interface apresenta mensagem, itens e ações sugeridas.

### Resultado vazio

1. A ferramenta é executada normalmente.
2. A resposta informa que nenhum registro foi encontrado.
3. A ação para abrir o módulo continua disponível.

### Resposta orientada

1. A intenção é reconhecida.
2. Não existe ferramenta real para ela.
3. O Copiloto explica a limitação.
4. A interface oferece acesso ao fluxo manual.

### Erro

1. A interface preserva as mensagens anteriores.
2. Exibe mensagem clara sem detalhes internos.
3. Oferece a opção “Tentar novamente”.
4. Não duplica a pergunta no histórico ao repetir a solicitação.

### Confirmação

Consultas não exigem confirmação.

Qualquer ação futura que altere dados deverá:

1. responder com `confirmation_required`;
2. apresentar o que será alterado;
3. mostrar impacto e dados principais;
4. exigir uma confirmação explícita;
5. permitir cancelamento;
6. registrar a execução no backend.

O MVP não executará alterações por conversa. Quando necessário, direcionará o usuário ao formulário manual correspondente.

## 9. Interface

Cada resposta poderá apresentar:

- texto principal;
- indicador de resposta real ou orientada;
- lista resumida de resultados;
- ações sugeridas;
- aviso de confirmação;
- opção de tentar novamente em caso de falha.

Os atalhos devem usar rotas internas do GestorIA e respeitar as permissões do usuário.

## 10. Critérios de aceite

- [X] Dez perguntas reais documentadas;
- [X] Contrato compartilhado entre backend e frontend;
- [X] Endpoint autenticado;
- [X] Isolamento por empresa testado;
- [X] Consulta real de pedidos em preparo;
- [X] Resultado vazio tratado;
- [X] Pergunta ainda não suportada tratada sem dados fictícios;
- [X] Interface apresenta itens e ações sugeridas;
- [X] Fluxos de carregamento, erro e confirmação representados;
- [X] Testes automatizados adicionados;
- [X] Lint, TypeScript, Ruff e Pytest aprovados.

## 11. Gateway Seguro — entrega de 26/10/2026

### Fronteiras e contrato

O endpoint continua recebendo apenas `{"message": "..."}` e preserva a estrutura das respostas de sucesso. Campos adicionais são rejeitados com 422. A sessão autenticada é a única fonte de `organization_id`, `user_id` e papel; campos de JSON, parâmetros de URL, cabeçalhos de empresa e instruções na mensagem não substituem essa identidade.

Fluxo de execução:

1. Sessão e CSRF são verificados; Pydantic valida o corpo da requisição.
2. O servidor reconhece uma intenção do registro fechado `COPILOT_TOOLS`.
3. Consome o orçamento da combinação `(organization_id, user_id)`.
4. Verifica o papel necessário antes de consultar dados ou chamar o provedor.
5. Valida argumentos tipados, consulta o repository com a empresa obrigatória e valida os DTOs de saída.
6. Entrega ao `CopilotAIProvider` somente `CopilotProviderRequest(intent, order_count)`.
7. Valida `CopilotProviderResponse`, monta itens e atalhos no servidor e persiste a auditoria antes de retornar.

`CopilotAIProvider` é um `Protocol`; a implementação `LocalCopilotProvider` mantém as respostas determinísticas do MVP. A dependência `get_copilot_provider` pode ser substituída por `MockCopilotProvider` nos testes. Apenas `COPILOT_PROVIDER=local` é suportado. Uma integração externa exige implementação própria, revisão de privacidade e testes; definir uma chave não ativa chamadas HTTP.

O provedor não recebe `Session`, models SQLAlchemy, callbacks, SQL, nomes de tabelas ou a pergunta livre. O registro é imutável e cada entrada declara o schema de argumentos e a política de acesso. Há uma ferramenta de leitura real e nove orientações controladas; `unknown` apenas produz a orientação de fallback. O provedor não escolhe ferramentas, argumentos, caminhos, permissões ou alterações de dados.

A consulta real projeta somente ID do pedido, nome do cliente, valor e data. Tanto `Order.organization_id` quanto `Customer.organization_id` precisam corresponder à empresa autenticada, inclusive diante de vínculos legados inconsistentes. ORM e relacionamentos não atravessam a fronteira do repository.

### Papéis e respostas de erro

| Operação | Permissão | Negativa |
| --- | --- | --- |
| Consultar pedidos e orientações comuns | Usuário autenticado na empresa ativa | 401 se sessão/vínculo inválido |
| `active_employees`, `cost_centers_summary`, `sales_today` | `owner` ou `admin` | 403 com auditoria `denied` |
| Listar/criar/ler/editar/resolver/cancelar `EmployeeRecord` | `owner` ou `admin` | 403 com auditoria `denied` |
| Usar ID de funcionário/registro de outra empresa | Nenhum papel concede acesso cruzado | 404 |
| Exceder o orçamento do Copiloto | Não executa ferramenta de negócio nem provedor | 429 + `Retry-After` |
| Falha de banco, provedor ou validação de saída | Resposta genérica, sem exceção/SQL/credenciais | 503 + auditoria `error` quando o banco permite |
| Falha ao persistir auditoria | Não entrega resultado de sucesso | 503 |

**Mudança intencional:** perguntas restritas anteriormente respondiam 200 com orientação de permissão; agora respondem 403. `sales_today` também é restrita por tratar de valores financeiros. Essa política do Copiloto não altera as permissões próprias do módulo Financeiro, inclusive a aprovação de leitura para membros.

Todas as rotas de `EmployeeRecord` autorizam antes da busca. As consultas existentes de Gestão Interna continuam filtrando organização, e suas FKs compostas preservam o vínculo entre funcionário, registro e responsáveis. Os services/repositories internos continuam sendo chamados após a autorização da camada HTTP; não são ferramentas expostas ao provedor.

### Configuração exclusiva do backend

| Variável | Padrão | Validação |
| --- | --- | --- |
| `COPILOT_PROVIDER` | `local` | Somente `local` nesta entrega |
| `COPILOT_API_KEY` | vazia | `SecretStr`, oculta no repr e na serialização JSON de Settings; reservada para integração futura |
| `COPILOT_RATE_LIMIT_MAX_REQUESTS` | `30` | De 1 a 1000 |
| `COPILOT_RATE_LIMIT_WINDOW_SECONDS` | `60` | De 1 a 3600 segundos |

As variáveis constam nos dois `.env.*.example` e são encaminhadas somente ao serviço `api` nos Composes de desenvolvimento e produção. Nunca usar prefixos `VITE_` ou `EXPO_PUBLIC_` para segredos. A chave não faz parte dos schemas públicos, do contexto do provedor, da auditoria ou dos diagnósticos. O gateway também recusa uma resposta que contenha o valor configurado da chave, incluindo campos de apresentação.

O contador usa UPSERT atômico no banco, seguindo o padrão do login, em uma tabela própria: `copilot_rate_limits`. É compartilhado entre processos/workers, usa janelas fixas e não confia em IP encaminhado por cabeçalhos. A limpeza remove janelas antigas somente do mesmo usuário e empresa. A autenticação, a atualização do contador e a gravação da auditoria continuam ocorrendo em requisições limitadas; consultas a pedidos e chamadas ao provedor não ocorrem. Erros de autenticação/CSRF e corpos inválidos são rejeitados antes desse fluxo.

### Auditoria e migrations

A head recebida no ZIP era `0013_finance_entry_versions`, filha do merge `2bde4cefcdec` (financeiro + vínculo produto/receita). A nova migration `0014_copilot_security_gateway` usa exatamente essa `down_revision`, mantendo uma única head. Isso descreve a cadeia presente no código; a revision aplicada em cada ambiente deve ser verificada com `alembic current`.

A tabela `copilot_tool_audit_logs` registra IDs de empresa/usuário, intenção reconhecida, nome da ferramenta, argumentos permitidos, status, duração em milissegundos e data UTC. Há índices de empresa, usuário, pergunta/ferramenta e empresa/data, checks de status/duração e uma FK composta para o vínculo do usuário na empresa. FKs `RESTRICT` preservam o histórico diante de exclusões físicas de empresas, usuários ou vínculos; desativar um vínculo continua permitido.

Status: `executed`, `denied`, `rate_limited`, `error`. Orientações e fallback também geram eventos. Negativas de `EmployeeRecord` usam `employee_records.list/create/read/update/resolve/cancel`, `question_id=null` e argumentos vazios. O log nunca armazena pergunta livre, resposta, nomes, dados pessoais, resultado de negócio, chave, cookie, SQL ou mensagem de exceção. Para pedidos, o único argumento registrado é `limit=5`; nas orientações o payload é `{}`.

A escrita e leitura do log ficam em `CopilotRepository`, exigindo organização explicitamente e validando os DTOs. Não foi exposto um endpoint de leitura de auditoria. Em falhas de consulta, o gateway desfaz a transação antes de registrar `error`; em caso de falha da própria auditoria, retorna 503 sem entregar dados. Nenhum sistema pode prometer persistência quando o banco de auditoria está indisponível.

O upgrade apenas cria as duas tabelas e os índices, sem reescrever dados de negócio. O downgrade online só remove tabelas vazias de auditoria; com eventos existentes, é bloqueado antes de qualquer remoção. Não excluir evidências para contornar essa proteção. O plano de reversão de uma implantação com histórico deve preservar essas tabelas e o backup.

### Validação e reprodução

Consulte `VALIDACAO-SEGURANCA.md` para os resultados desta execução, os limites reais e os comandos completos. Os testes cobrem sessão/empresa, RBAC em todas as operações de registros, provedor mockado sem acesso ao banco, entradas e saídas inválidas, chave em exceções/respostas, auditoria de sucesso/bloqueio/erro, rollback, janela e concorrência do contador e upgrade/downgrade da migration.
