# Correções do fluxo de venda (simulação de cliente)

Correções feitas a partir da simulação "Confeitaria Doce Rita", em que uma empresa
que produz sob encomenda não conseguia vender pelo sistema sem contornar regras.

## Banco de dados — migração `0020_made_to_order_receivables`

| Mudança | Para que serve |
| --- | --- |
| `products.made_to_order` (padrão `false`) | Produto vendido antes de existir pronto. |
| `order_items.stock_deducted` (padrão `true`) | Guarda se o item tirou estoque; cancelar ou excluir devolve só o que saiu. |
| `orders.code` + `organizations.next_order_code` | Número do pedido por empresa (`PED-000001`). Pedidos antigos são numerados pela data de criação. |
| `finance_entries.order_id` (FK `SET NULL`) | Liga a conta a receber ao pedido de origem. |
| Categoria `confeitaria` e unidade `l` | Novas opções no cadastro de produtos. |
| Categorias financeiras padrão | Criadas só para empresas que ainda não têm nenhuma categoria. |

O downgrade é bloqueado se já houver produtos em Confeitaria/litro ou pedidos com
itens sob encomenda. As categorias padrão só são removidas se não tiverem lançamentos.

## Regras novas

1. **Venda sob encomenda.** Produto marcado como "Vendido sob encomenda" entra em
   orçamento e pedido sem estoque pronto. O status do produto passa a ser
   "Sob encomenda" e ele não conta como estoque crítico. Produtos sem a marcação
   continuam exigindo estoque; a mensagem de falta de estoque sugere a marcação
   quando o produto é fabricado.
2. **Data de entrega na conversão.** `POST /api/quotes/{id}/convert` aceita, de forma
   opcional, `promised_at` (com fuso), `priority` e `notes`. A tela pede a data.
3. **Contas a receber.** Ao criar o pedido (direto ou convertido), o sistema lança
   uma conta a receber pendente na categoria "Vendas", na mesma transação. O
   orçamento parcelado vira uma parcela por mês; os centavos que sobram ficam na
   primeira. O vencimento é o dia da entrega (ou hoje, sem data).
   - Cancelar o pedido cancela as parcelas pendentes; as já recebidas ficam.
   - Reativar o pedido reabre as parcelas canceladas.
   - Excluir o pedido cancela as pendentes e desfaz o vínculo; o histórico fica.
   - A receita só entra no resumo do Financeiro depois da baixa.
4. **CPF/CNPJ.** Clientes e Empresa conferem os dígitos verificadores, no servidor
   e na tela. O cliente pessoa física usa CPF e o pessoa jurídica, CNPJ.

## Telas

- Datas padrão usam o dia local (antes, depois das 21h sugeriam o dia seguinte).
- Quantidades sem zeros inúteis ("3" em vez de "3.000").
- NCM e CEST aceitam colar com pontos.
- Erros de validação do servidor aparecem em português, com o nome do campo.
- Visão geral: notas fiscais pendentes, saldo realizado (com acesso ao
  Financeiro) e primeiros passos para empresa nova.
- Máscaras de CPF/CNPJ, telefone e CEP; lista de UF.
- Copiloto envia com Enter (Shift+Enter pula linha).
- Atalho "Cadastrar categoria" volta ao lançamento.

## Testes

- Backend: `tests/test_made_to_order_and_receivables.py`,
  `tests/test_made_to_order_migration.py`, `tests/test_tax_documents_api.py`.
- Frontend: `tests/salesFlowFixes.test.cjs`.

## Fica para depois

- Consumir automaticamente os ingredientes da receita ao concluir o pedido.
- Busca de endereço pelo CEP (exige liberar o serviço externo na política de segurança).
- CNPJ alfanumérico da Receita Federal (o sistema todo ainda aceita só números).
