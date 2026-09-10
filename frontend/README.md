# GestorIA Frontend

Frontend React do GestorIA, usando TypeScript, Vite, Tailwind CSS 4 e Lucide React.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

Durante o desenvolvimento, `/api` é encaminhado para `http://localhost:8000`.

## Rotas

`/login`, `/dashboard`, `/clientes`, `/produtos`, `/pedidos`, `/orcamentos`, `/copiloto`, `/modo-fabrica`, `/notas-fiscais` e `/empresa/editar`.

## Estilos

O projeto usa Tailwind CSS 4 com o plugin oficial do Vite. A entrada única de estilos é `src/styles/tailwind.css`, que contém o tema, a camada base e componentes compostos com `@apply`.

## Produção

O build é gerado em `dist/`. O Docker constrói esse diretório e o FastAPI o serve com fallback para as rotas do React.
