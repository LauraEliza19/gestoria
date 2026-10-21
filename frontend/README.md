# GestorIA Web

Aplicação web operacional do GestorIA, construída com React, TypeScript, Vite e Tailwind CSS. A interface consome a API FastAPI e concentra cadastros, operação detalhada e administração da empresa.

## Tecnologias

- React 19;
- TypeScript 6;
- Vite 8;
- React Router 7;
- Tailwind CSS 4;
- Lucide React;
- Oxlint, Prettier e Node Test Runner.

## Módulos e rotas

| Área | Rotas principais | Estado |
|---|---|---|
| Autenticação | `/login`, `/logout` | funcional |
| Visão geral | `/dashboard` | funcional |
| Clientes | `/clientes`, `/clientes/novo`, `/clientes/:id` | funcional |
| Produtos | `/produtos`, `/produtos/novo` | funcional |
| Pedidos | `/pedidos`, `/pedidos/novo` | funcional |
| Orçamentos | `/orcamentos` | funcional |
| Produção | `/modo-fabrica` | funcional |
| Fiscal | `/notas-fiscais` | funcional |
| Financeiro | `/financeiro`, categorias e lançamentos | funcional |
| Gestão interna | `/gestao`, funcionários, vínculos, registros e centros de custo | funcional |
| Empresa | `/empresa/editar` | funcional |
| Copiloto | `/copiloto` | MVP controlado |

As rotas protegidas exigem sessão válida. A interface pode ocultar ou bloquear recursos conforme a permissão, mas a autorização definitiva sempre acontece no backend.

## Organização

```text
frontend/
├── src/
│   ├── app/          roteamento e entrada da aplicação
│   ├── components/   componentes compartilhados
│   ├── contexts/     sessão e estado transversal
│   ├── layouts/      composição das páginas protegidas
│   ├── pages/        telas organizadas por domínio
│   ├── services/     acesso à API
│   └── styles/       tema e estilos Tailwind
├── tests/            contratos e fluxos da interface
└── package.json
```

## Executar em desenvolvimento

Com a API disponível em `http://localhost:8000`:

```powershell
cd frontend
npm ci
npm run dev
```

Durante o desenvolvimento, as requisições para `/api` são encaminhadas à API local. O endereço do Vite é apresentado no terminal.

## Comandos

```powershell
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run check
npm run preview
```

`npm run check` executa formatação, lint, tipos, testes e build.

## Sessão e chamadas HTTP

- a API autentica por cookie `HttpOnly`;
- o frontend envia credenciais de mesma origem;
- mutações incluem a proteção CSRF exigida pelo backend;
- após um `401`, o cliente tenta renovar a sessão uma vez;
- tokens antigos deixados em armazenamento do navegador são removidos;
- dados e permissões sempre são limitados à organização autenticada.

## Estilos

O projeto usa Tailwind CSS 4 com o plugin oficial do Vite. A entrada principal é `src/styles/tailwind.css`, que reúne tema, camada base e componentes compostos.

As interfaces devem oferecer estados claros de carregamento, vazio, erro e sucesso. Funcionalidades planejadas não devem ser apresentadas como concluídas.

## Produção

```powershell
npm run build
```

O build é gerado em `dist/`. A imagem Docker incorpora esse diretório, e o FastAPI serve os arquivos estáticos com fallback para as rotas do React. Em produção, o Caddy fornece HTTPS e encaminha o tráfego para a API.

Consulte também o [README principal](../README.md), a [arquitetura](<../docs/entregaEtapa3/Arquitetura do Sistema.md>) e o [guia de contribuição](../CONTRIBUTING.md).
