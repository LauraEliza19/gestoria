# Copiloto GestorIA — contrato do MVP controlado

## 1. Objetivo

O primeiro MVP do Copiloto oferece uma conversa orientada para consultas empresariais.

Nesta etapa, o Copiloto não utiliza um provedor externo de inteligência artificial. As intenções são reconhecidas de forma controlada e somente ferramentas autorizadas podem consultar dados reais.

A primeira ferramenta real será a consulta de pedidos em preparo. As demais perguntas recebem respostas orientativas e atalhos para os módulos correspondentes, sem inventar informações.

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
| 7 | Quanto vendemos hoje? | `sales_today` | Resposta controlada | Abrir visão geral |
| 8 | Quais são os nossos principais clientes? | `top_customers` | Resposta controlada | Abrir clientes |
| 9 | Quantos funcionários ativos temos? | `active_employees` | Resposta controlada e restrita | Abrir funcionários |
| 10 | Como estão distribuídos os centros de custo? | `cost_centers_summary` | Resposta controlada e restrita | Abrir centros de custo |

Perguntas não reconhecidas utilizam a intenção `unknown`.

## 4. Contexto permitido

O contexto de uma solicitação pode conter somente:

- identificador e nome da empresa autenticada;
- identificador, nome e papel do usuário autenticado;
- data e hora da solicitação;
- mensagem enviada pelo usuário;
- intenção reconhecida;
- resultado estritamente necessário da ferramenta autorizada;
- permissões necessárias para apresentar ações;
- identificadores necessários para criar links internos.

Não entram no contexto:

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