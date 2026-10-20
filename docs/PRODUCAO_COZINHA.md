# Produção na Cozinha

Na rota /modo-fabrica, abra **Produção e receitas**.

## Receitas independentes do estoque

Em **Receitas**, cadastre nome, rendimento e ingredientes mesmo com o estoque vazio. Digite o nome de cada ingrediente e selecione uma sugestão ou confirme **Cadastrar como novo ingrediente**. Ingredientes criados nesse formulário são referências das receitas; não criam saldo ou item em estoque.

A busca ignora maiúsculas, acentos e espaços repetidos e sugere nomes com erros de digitação, inclusive letras trocadas. Nomes apenas parecidos nunca são associados automaticamente. A escolha precisa ser confirmada. Nomes exatamente equivalentes após normalização reutilizam o mesmo cadastro.

## Estoque e marcas

Em **Estoque**, informe:
- Nome do item ou marca, por exemplo **Farinha Santa Amália**.
- **Corresponde ao ingrediente**, por exemplo **Farinha de trigo**, selecionado nas sugestões.
- Saldo total disponível e unidade.

Marcas diferentes associadas ao mesmo ingrediente somam seus saldos com conversão entre g/kg e ml/L. Não existe conversão entre massa, volume e unidades. Para xícaras ou colheres, informe a equivalência medida em g ou ml. As entradas aceitam até três casas decimais.

**Editar item** permite corrigir o saldo, o nome e a associação sem modificar as receitas. Ao mudar a unidade, informe o saldo na nova unidade. Excluir um item remove apenas esse saldo; receitas e ingredientes de referência são mantidos, e a disponibilidade é recalculada. Exclusões exigem owner/admin.

## Consulta

Em **O que posso preparar**, as receitas aparecem separadas em **Prontas para produzir** e **Bloqueadas por falta de insumos**. As prontas mostram quantas receitas completas dá para fazer, o rendimento possível, o ingrediente limitante e o que falta para mais uma receita. As bloqueadas mostram cada insumo faltante com a quantidade necessária, o saldo atual e a falta. Busque por receita ou ingrediente e filtre por situação. Sem item associado em estoque, a disponibilidade do ingrediente é zero.

Cada receita é calculada individualmente sobre todo o estoque. Não some as opções como se pudessem ser feitas simultaneamente: elas podem disputar ingredientes. A consulta não reserva nem desconta saldos.

## Produtos vendidos e receitas

No cadastro do produto, escolha a **Receita de produção**. O vínculo é feito pelo ID da receita, nunca pelo nome: renomear a receita ou o produto mantém a associação, e um produto sem receita escolhida não é associado automaticamente, mesmo que os nomes coincidam. Excluir uma receita deixa os produtos vinculados sem receita; os produtos são mantidos.

## Insumos da fila de pedidos

Na **Fila de pedidos**, cada pedido em preparo recebe um selo:
- **Insumos suficientes**: todos os itens têm receita calculável e o estoque atende o pedido.
- **Faltam insumos**: algum insumo não é suficiente depois dos pedidos anteriores.
- **Cobertura parcial**: o estoque atende os itens calculados, mas algum item não tem receita ou tem unidade incompatível.
- **Sem receita vinculada**: nenhum item do pedido tem receita.

**Consultar insumos** mostra, por insumo, quanto o pedido precisa, quanto está disponível para ele e quanto falta. Os pedidos são atendidos na ordem da fila (mais antigos primeiro, independentemente da busca ou da ordenação exibida): cada pedido reserva virtualmente o que precisa e os seguintes só contam com o saldo restante. Um pedido antigo sem insumos suficientes continua com prioridade sobre o que existe. A reserva é apenas uma simulação na tela e não desconta o estoque.

A quantidade é proporcional ao rendimento. Produtos vendidos por unidade exigem receitas com rendimento em unidades, porções ou peças; produtos vendidos em kg ou g exigem rendimento em g ou kg. Outros rendimentos, como fatias, aparecem como não calculados.

**Atualizar** consulta a fila e os insumos ao mesmo tempo e só informa **Fila e insumos atualizados** depois que as duas consultas terminam. Se uma delas falhar, a mensagem indica qual parte não foi atualizada.

## API

- GET /api/production: ingredients (referências), stock_items (saldos/marcas), recipes (receitas e disponibilidade).
- POST /api/production/stock-items: cria um item de estoque.
- PUT /api/production/stock-items/{id}: substitui nome, quantidade, unidade e associação.
- DELETE /api/production/stock-items/{id}: exclui só o item de estoque.
- POST /api/production/recipes: cria receita e novos ingredientes em uma transação.
- PUT /api/production/recipes/{id}: substitui nome, rendimento e composição.
- DELETE /api/production/recipes/{id}: exclui receita e composição, preservando estoque e desvinculando os produtos.
- POST/PATCH /api/products: aceitam `recipe_id` (receita da mesma empresa ou `null`); receita inexistente ou de outra empresa retorna 422.
- GET /api/orders: cada item traz `recipe_id` e `unit_of_measure` do produto.

Cada referência de ingrediente aceita **ingredient_id** de um cadastro existente ou **ingredient_name** de um novo ingrediente, nunca os dois. O servidor valida empresa, unidades e ingredientes repetidos após normalização. Falhas desfazem a transação inteira.

## Migration e validação

A migration **0012_product_recipe_link** adiciona `products.recipe_id` com chave estrangeira composta por empresa. Produtos existentes começam sem receita. O downgrade é bloqueado enquanto houver produtos vinculados.

A migration **0008_recipe_ingredients**, posterior à 0007 já aplicada, transfere todos os saldos antigos para production_stock_items, mantendo os IDs e vínculos das receitas. Nomes antigos são preservados, inclusive marcas; a associação pode ser corrigida pelo formulário. O downgrade com ingredientes cadastrados é bloqueado para evitar perda de informação.

Atualizar o ambiente local:

```powershell
docker compose up -d --build --no-deps api
```

Testes do backend e migrations usam o PostgreSQL temporário de docker-compose.test.yml. Os testes de sugestões não exigem novas dependências:

```powershell
cd frontend
node --test tests/ingredientSuggestions.test.cjs
npm run lint
npm run build
```

## Registrar uso de ingredientes

Em **Estoque**, clique em **Registrar uso** no item utilizado. Escreva **800g**, **meio quilo**, **250 ml**, **2 unidades**, **metade** ou **tudo**. Sem unidade, o campo considera gramas, mililitros ou unidades, conforme o item. A conversão para a unidade cadastrada é automática: 800 g baixam 0,8 kg. Também é possível tocar nas quantidades rápidas, usar os botões de mais/menos ou arrastar a barra. Confira quanto usou e quanto vai sobrar e confirme em **Usei [quantidade]**. Medidas incompatíveis, acima do saldo ou que exigiriam arredondar o consumo são recusadas. A baixa atualiza o estoque e recalcula a disponibilidade das receitas. Um item zerado permanece cadastrado.

`POST /api/production/stock-items/{id}/consume` recebe `quantity` (positiva, até três casas decimais), `unit` e `expected_quantity` (saldo exibido). Retorna o item atualizado. A baixa é atômica e isolada por empresa: saldo insuficiente, unidade alterada ou saldo diferente do informado retornam 409 sem baixar estoque. Dados inválidos retornam 422; item inexistente ou de outra empresa retorna 404.

Se houver erro de comunicação, atualize e confira o saldo antes de tentar novamente. A interface bloqueia novos usos até essa atualização. Esta ação registra a baixa manual no saldo; ainda não mantém um histórico de movimentos nem cria demandas ou reservas.
