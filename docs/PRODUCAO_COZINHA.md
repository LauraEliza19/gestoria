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

Em **O que posso preparar**, veja receitas completas possíveis, rendimento e faltas para uma receita. Sem item associado em estoque, a disponibilidade do ingrediente é zero.

Cada receita é calculada individualmente sobre todo o estoque. Não some as opções como se pudessem ser feitas simultaneamente: elas podem disputar ingredientes. A consulta não reserva nem desconta saldos. Produtos vendidos e a fila de pedidos continuam separados.

## API

- GET /api/production: ingredients (referências), stock_items (saldos/marcas), recipes (receitas e disponibilidade).
- POST /api/production/stock-items: cria um item de estoque.
- PUT /api/production/stock-items/{id}: substitui nome, quantidade, unidade e associação.
- DELETE /api/production/stock-items/{id}: exclui só o item de estoque.
- POST /api/production/recipes: cria receita e novos ingredientes em uma transação.
- PUT /api/production/recipes/{id}: substitui nome, rendimento e composição.
- DELETE /api/production/recipes/{id}: exclui receita e composição, preservando estoque.

Cada referência de ingrediente aceita **ingredient_id** de um cadastro existente ou **ingredient_name** de um novo ingrediente, nunca os dois. O servidor valida empresa, unidades e ingredientes repetidos após normalização. Falhas desfazem a transação inteira.

## Migration e validação

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
