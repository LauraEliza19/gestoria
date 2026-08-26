# 🎨 GestorIA — Documentação do Frontend

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)
![Status](https://img.shields.io/badge/status-protótipo%20funcional-yellow)

Documentação de tudo que foi construído no **frontend** do GestorIA, **antes** de qualquer linha de backend em Python — um protótipo 100% funcional no navegador (HTML + CSS + JavaScript puro, sem framework), usado para validar fluxos, decisões visuais e comportamento do produto antes de gastar tempo de backend.

> **Importante:** durante todo este período, os dados eram simulados em arrays JavaScript na memória do navegador — nada persistia de verdade. A conexão com API real só começou depois, com o backend Python (documentado separadamente).

---

## 📑 Sumário

- [Arquivos do projeto](#-arquivos-do-projeto)
- [Identidade visual](#-identidade-visual)
- [Tela de Login](#-tela-de-login)
- [Estrutura do Dashboard](#-estrutura-do-dashboard)
- [Seções implementadas](#-seções-implementadas)
- [Sistema de modais](#-sistema-de-modais)
- [Chat com IA (simulado)](#-chat-com-ia-simulado)
- [Log de auditoria](#-log-de-auditoria)
- [Conta e personalização](#-conta-e-personalização)
- [Modo escuro](#-modo-escuro)
- [Limitações conhecidas](#-limitações-conhecidas)

---

## 🔹 Arquivos do projeto

| Arquivo | Conteúdo |
|---|---|
| `login.html` | Tela de login |
| `dashboard.html` | Aplicação principal (todas as seções) |
| `style.css` | Estilos compartilhados (tokens de cor/tipografia, componentes de formulário, tela de login) |
| `styleDashboard.css` | Estilos específicos do dashboard (chat, navegação, tabelas, modais) |

---

## 🔹 Identidade visual

**Paleta de marca:**
- Navy escuro (`#0B1330`) e índigo (`#131B4A`) — usados no painel de chat/hero, sempre escuros independente do tema
- Azul de destaque (`#3D63F5`) — ações primárias, links, elementos ativos
- Cinza-azulado claro (`#F7F8FC`) — fundo da área de dados

**Tipografia:**
- `Space Grotesk` — títulos e wordmark da marca
- `Inter` — corpo de texto, formulários
- `JetBrains Mono` — detalhes técnicos (badges, labels pequenos)
- Posteriormente, o dashboard passou a usar `-apple-system` (fonte nativa do sistema) numa repaginação com influência mais minimalista/Apple, mantendo a paleta de cores original

**Sistema de tokens CSS:** cores como `--ink-primary`, `--surface-raised`, `--hairline` etc. foram criadas como uma camada "neutra" reutilizável, o que depois permitiu implementar o modo escuro sem reescrever nenhum componente — só redefinindo os tokens.

---

## 🔹 Tela de Login

- Layout dividido: painel escuro à esquerda (marca + gráfico ilustrando o conceito do produto: texto → intent → confirmação) e formulário claro à direita
- Validação de e-mail e senha, com mensagens de erro inline
- Botão de mostrar/ocultar senha
- Totalmente responsivo (colapsa para uma coluna em telas pequenas)

---

## 🔹 Estrutura do Dashboard

Layout híbrido definido logo no início do projeto:

```
┌──────────┬─────────────────┬──────────────────────────────┐
│ Trilha   │  Chat com IA    │      Área de dados            │
│ de nave- │  (sempre        │  (topbar + conteúdo dinâmico  │
│ gação    │  visível)       │   por seção)                  │
└──────────┴─────────────────┴──────────────────────────────┘
```

- **Trilha de navegação** (ícones): Visão geral, Clientes, Produtos, Pedidos, Orçamentos, Relatórios, Atividade, Perfil
- **Chat lateral**: sempre visível, independente da seção ativa
- **Área central**: muda de conteúdo conforme a seção selecionada, e também reage a respostas do chat

---

## 🔹 Seções implementadas

### Visão geral
- Saudação dinâmica ("Bom dia/Boa tarde/Boa noite, [nome]") baseada no horário do sistema e no funcionário ativo
- Botão de mostrar/ocultar valores sensíveis (KPIs aparecem borrados por padrão, como em apps bancários)
- Cards de KPI: Faturamento, Clientes ativos, Pedidos hoje
- Widget de atividade recente (últimas 3 ações do log)
- Área de "Resultados de comandos" — onde respostas do chat aparecem

### Clientes
- Busca por nome/telefone + ordenação (maior gasto / nome A-Z / mais recente)
- Tabela com ações de editar/excluir por linha
- Nome do cliente é clicável → abre modal de detalhes com histórico de Pedidos e Orçamentos daquele cliente
- Estado de "primeiro acesso" com CTA quando não há clientes cadastrados

### Produtos
- Tabela com badge de status colorido (Disponível / Estoque baixo / Esgotado)
- Cadastro/edição via modal

### Pedidos
- Tabela com badge de status (Em preparo / Concluído / Cancelado)
- Número do pedido clicável → abre modal "Ver itens" (ou mensagem de que o pedido não tem detalhamento, se foi criado sem itens)

### Orçamentos
- Formulário de criação com **itens dinâmicos** (adicionar/remover produtos, quantidade e preço, total recalculado em tempo real)
- Fluxo de status: Pendente → Aprovar/Recusar → Converter em pedido
- Conversão gera um Pedido de verdade na aba Pedidos, **levando os itens junto**

### Relatórios
- Exportação **real** em CSV (gera e baixa o arquivo)
- Exportação em PDF via `window.print()`, com CSS específico de impressão (esconde chat/menu, força fundo branco mesmo no modo escuro)

### Atividade
- Log completo de ações (quem fez, quando, o quê, executado ou cancelado)

### Perfil
- Dados do funcionário logado
- Dados da empresa (nome, CNPJ, telefone, endereço), editáveis via modal
- Lista de funcionários com opção de trocar (simulando troca de usuário)

---

## 🔹 Sistema de modais

Construído como um sistema genérico reutilizável (`modalConfigs`), usado por Cliente, Produto, Pedido e Dados da empresa:

- Um único conjunto de funções (`openModal`, `closeModal`) serve **tanto para criar quanto para editar** — o modal detecta o modo pelo parâmetro recebido, muda o título e pré-preenche os campos automaticamente
- Modal de **confirmação de exclusão** também é genérico e reutilizado por todas as seções
- Modais especializados (fora do sistema genérico, por serem mais complexos): Novo orçamento (itens dinâmicos), Ver itens, Detalhes do cliente

---

## 🔹 Chat com IA (simulado)

- Interpretação de comandos por palavras-chave (`interpretAndRespond`) — sem IA real, só lógica de `if/else` fazendo o papel do futuro AI Orchestrator
- Respostas em texto simples ou em tabela, dependendo do tipo de pergunta
- **Cartão de confirmação**: ao pedir uma ação que altera dados (ex: "cadastre a Maria como cliente"), a IA não executa direto — mostra um indicador de confiança (Alta/Média/Baixa, calculado por quantos campos foram identificados no texto), campos editáveis, e exige Confirmar/Cancelar antes de agir

---

## 🔹 Log de auditoria

- Toda ação que altera dados — feita pela IA no chat ou manualmente pelos formulários — é registrada
- Cada entrada mostra: horário, descrição, quem fez (badge "IA (chat)" ou "Manual") e status (Executado/Cancelado)

---

## 🔹 Conta e personalização

- Menu no avatar: Meu perfil, Trocar de funcionário (não "empresa" — decisão consciente, já que trocar de empresa não faz sentido de negócio sem ser via filial), Sair
- Logout redireciona de verdade para a tela de login

---

## 🔹 Modo escuro

- Toggle com ícone de sol/lua no topbar
- Preferência salva via `localStorage`, persistindo entre sessões
- Script no `<head>` aplica o tema salvo antes da página desenhar, evitando o "flash" de tela clara
- Implementado sobrescrevendo só os tokens neutros (`--ink-primary`, `--surface-app` etc.) — a barra de chat, que já era escura por design, não muda
- Área de impressão (PDF) é forçada a ficar sempre branca, independente do tema ativo

---

## 🔹 Limitações conhecidas

- Todos os dados eram **fixos em arrays JavaScript**, sem nenhuma persistência real
- A ligação entre Cliente e seus Pedidos/Orçamentos era feita comparando o **nome digitado** (não um ID de verdade) — problema resolvido só depois, com o backend real usando UUIDs
- A interpretação de linguagem natural no chat era só correspondência de palavras-chave, não IA de verdade
- Sem autenticação real — qualquer um "logava" só clicando o botão

---

<sub>Documentação gerada em Agosto de 2026, cobrindo o trabalho de frontend realizado antes do início do desenvolvimento do backend em Python.</sub>
