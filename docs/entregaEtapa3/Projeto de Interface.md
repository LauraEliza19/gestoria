# Projeto de Interface — GestorIA

## 1. Identificação

- **Produto:** GestorIA
- **Tipo:** sistema de gestão empresarial com aplicações web e mobile
- **Público principal:** proprietários, administradores e equipes operacionais de pequenas e médias empresas
- **Objetivo da interface:** transformar dados comerciais, operacionais, fiscais e administrativos em informações claras e ações seguras.
- **Estado do projeto:** interfaces funcionais em implementação contínua; não se trata apenas de protótipos.

## 2. Problema de interface

O gestor precisa acompanhar áreas diferentes da empresa sem navegar por planilhas e sistemas isolados. A interface deve reduzir três dificuldades principais:

1. demora para entender a situação atual da empresa;
2. excesso de informação sem hierarquia de prioridade;
3. risco de executar ações importantes sem contexto, confirmação ou permissão.

Por isso, o GestorIA foi organizado para responder rapidamente a três perguntas:

- **O que está acontecendo?**
- **O que precisa de atenção?**
- **Qual é a próxima ação recomendada?**

## 3. Princípios de experiência

### 3.1 Clareza antes de densidade

Os dados mais importantes aparecem primeiro. Informações secundárias ficam em detalhes, filtros ou páginas específicas.

### 3.2 Hierarquia visual consistente

Títulos, indicadores, estados, alertas e ações seguem padrões repetidos para que o usuário reconheça rapidamente a função de cada elemento.

### 3.3 Decisão com contexto

Ações sensíveis devem exibir origem, impacto e confirmação. O sistema não deve induzir o usuário a confirmar uma operação sem entender suas consequências.

### 3.4 Continuidade entre web e mobile

A versão web prioriza operação completa e cadastros detalhados. O aplicativo mobile prioriza acompanhamento executivo, alertas e decisões rápidas. As duas interfaces consomem a mesma API e representam os mesmos dados da empresa.

### 3.5 Estados explícitos

As telas devem apresentar carregamento, vazio, sucesso, erro, bloqueio e falta de permissão de forma compreensível.

## 4. Arquitetura de informação

### 4.1 Aplicação web

| Área | Telas ou recursos implementados |
|---|---|
| Autenticação | login, encerramento e renovação de sessão |
| Visão geral | painel com indicadores e atalhos operacionais |
| Clientes | listagem, cadastro, edição e perfil |
| Produtos | listagem, cadastro, edição, estoque e dados fiscais |
| Pedidos | listagem, criação e operações de andamento |
| Orçamentos | listagem, criação e mudança de situação |
| Produção | modo fábrica, receitas, disponibilidade e fila de produção |
| Fiscal | consulta, estados, detalhes, histórico e vínculos |
| Financeiro | resumo, categorias, lançamentos, filtros, cadastro e atualização |
| Gestão interna | funcionários, vínculos, centros de custo e ocorrências |
| Empresa | dados cadastrais da organização |
| Copiloto | perguntas controladas, respostas fundamentadas e atalhos |

O módulo financeiro foi integrado à branch principal pelo PR nº 40. Ele possui backend, migration, testes e telas web para resumo, categorias e lançamentos. A experiência financeira no aplicativo mobile ainda está planejada.

### 4.2 Aplicação mobile

A navegação principal usa cinco destinos:

1. **Início:** visão executiva da empresa;
2. **Alertas:** fila central de situações que precisam de atenção;
3. **Copiloto:** consultas em linguagem natural e orientação entre módulos;
4. **Módulos:** catálogo organizado das áreas do sistema;
5. **Conta:** usuário, empresa, permissão e encerramento da sessão.

O módulo de **Pedidos** já possui uma tela funcional no aplicativo e é aberto de forma contextual. Os demais módulos aparecem organizados no catálogo e serão integrados progressivamente, sem sugerir ao usuário que uma função indisponível já está pronta.

## 5. Fluxos principais

### 5.1 Entrada no sistema

1. O usuário informa e-mail e senha.
2. A interface envia as credenciais pela conexão com a API.
3. Em caso de sucesso, a sessão é criada e o usuário é direcionado ao painel.
4. Em caso de erro, a interface mantém o contexto e apresenta mensagem compreensível.
5. Rotas protegidas verificam a sessão e as permissões antes de exibir dados.

### 5.2 Consulta executiva no mobile

1. O gestor abre o aplicativo.
2. O painel apresenta vendas, pedidos em andamento, estoque crítico e prioridades.
3. A situação de maior impacto é destacada em “Em foco agora”.
4. O usuário pode abrir o módulo de origem ou consultar o Copiloto.

### 5.3 Acompanhamento de pedidos

1. O usuário acessa Pedidos.
2. Pesquisa por cliente, pedido ou produto.
3. Filtra por situação.
4. Consulta itens, total e andamento do pedido.
5. Operações que alteram o pedido respeitam permissão, validação e auditoria no backend.

### 5.4 Produção e estoque

1. O usuário consulta a fila ou as receitas.
2. O sistema calcula a disponibilidade conforme os ingredientes.
3. Receitas bloqueadas mostram os insumos responsáveis.
4. O consumo de estoque acontece no fluxo operacional protegido contra repetição e concorrência.

### 5.5 Fiscal

1. O usuário consulta documentos fiscais.
2. Filtra ou identifica estados de processamento, autorização, rejeição e cancelamento.
3. Abre detalhes e histórico.
4. Trata a pendência conforme o estado permitido.

### 5.6 Copiloto

1. O usuário seleciona uma pergunta sugerida ou escreve uma consulta.
2. O sistema reconhece uma intenção permitida.
3. Uma ferramenta controlada consulta dados somente da empresa autenticada.
4. A resposta mostra orientação, fonte e, quando aplicável, um atalho.
5. Ações críticas não são executadas sem confirmação.

O Copiloto atual é um MVP controlado. A abstração permite evolução futura, mas a versão consolidada ainda não usa um provedor externo de inteligência artificial.

## 6. Identidade visual

O mobile adota a identidade visual **Sereno**, construída para transmitir controle, confiança e elegância sem sobrecarregar o usuário.

### 6.1 Paleta principal do mobile

| Uso | Cor |
|---|---|
| Fundo principal | `#071225` |
| Fundo secundário | `#0B1930` |
| Superfície escura | `#10213D` |
| Azul principal | `#2867E8` |
| Ciano da marca | `#17AEE6` |
| Folha clara | `#F5F7FC` |
| Texto em fundo escuro | `#F6F8FC` |
| Sucesso | `#38B980` |
| Atenção | `#DFA72D` |
| Perigo | `#E86F87` |

### 6.2 Padrões de composição

- cabeçalho escuro com mensagem direta e indicadores essenciais;
- conteúdo operacional em folha clara de cantos amplos;
- barra inferior flutuante, com cinco destinos estáveis;
- azul usado para seleção e ação, não como decoração excessiva;
- cores de estado reservadas para significado operacional;
- espaçamentos e raios definidos por tokens reutilizáveis;
- ícones acompanhados de rótulos ou contexto acessível.

## 7. Componentes reutilizáveis

No mobile, o conjunto `SereneLayout` concentra padrões compartilhados de cabeçalho, folha de conteúdo e estrutura visual. Os tokens de cor, espaçamento, tipografia e bordas ficam centralizados no tema.

Componentes e padrões principais:

- cabeçalho executivo;
- folha de conteúdo;
- cartões de indicadores;
- itens de prioridade;
- chips de filtro e situação;
- campos de busca;
- botões primários e secundários;
- mensagens de carregamento, vazio e erro;
- barra de navegação inferior.

Na web, layouts protegidos, portões de permissão, serviços de API e componentes de página fornecem consistência entre os módulos.

## 8. Responsividade e acessibilidade

O projeto considera:

- áreas seguras do dispositivo móvel;
- rolagem em conteúdos extensos;
- ajuste ao teclado nos formulários;
- rótulos de acessibilidade nos itens de navegação;
- contraste entre texto, fundo e estados;
- tamanho de toque adequado para ações principais;
- mensagens textuais além da indicação exclusiva por cor;
- navegação protegida por autenticação e permissão.

## 9. Situação de implementação

| Entrega | Situação |
|---|---|
| Interface web funcional | Implementada e em evolução |
| Identidade e componentes web | Implementados |
| Login e sessão | Implementados em web e mobile |
| Painel executivo mobile | Implementado |
| Alertas mobile | Implementado |
| Copiloto mobile | Implementado como MVP controlado |
| Pedidos mobile | Implementado |
| Catálogo de módulos mobile | Implementado |
| Demais módulos mobile | Integração progressiva |
| Financeiro web | Implementado e integrado à branch principal |
| Financeiro mobile | Planejado |
| Provedor real de IA | Planejado, ainda não integrado |

## 10. Critérios de validação da interface

Uma tela é considerada pronta para revisão quando:

- usa os componentes e tokens definidos;
- apresenta estados de carregamento, vazio e erro;
- não exibe ação sem destino funcional;
- respeita autenticação e permissão;
- funciona nos tamanhos de tela previstos;
- passa por verificação de tipos, lint e testes aplicáveis;
- mantém os dados isolados por organização;
- fornece confirmação em operações sensíveis.

## 11. Evidências no repositório

- Web: `frontend/src/pages/`, `frontend/src/layouts/` e `frontend/src/app/router.tsx`.
- Mobile: `mobile/src/features/`, `mobile/src/components/serene/` e `mobile/src/theme/tokens.ts`.
- Testes de interface web: `frontend/tests/`.
- Testes de interface mobile: `mobile/tests/`.
- Regras de negócio e contratos: `backend/app/services/`, `backend/app/schemas/` e `backend/app/api/`.
- Documentação complementar: `docs/` e `Documentação de Contexto/`.

## 12. Próximos passos de interface

1. integrar os módulos funcionais restantes ao aplicativo mobile;
2. adaptar a experiência do módulo financeiro para o aplicativo mobile;
3. executar testes de uso com usuários do público-alvo;
4. acrescentar notificações, biometria e recursos de câmera após estabilizar os fluxos centrais;
5. manter registros visuais das telas finais para a apresentação acadêmica.
