# GestorIA Frontend — React + TypeScript + Vite

Este frontend React substitui gradualmente as páginas HTML legadas do GestorIA.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

Durante o desenvolvimento, `/api` é encaminhado para `http://localhost:8000`.

## Rotas migradas

`/login`, `/dashboard`, `/clientes`, `/produtos`, `/pedidos`, `/orcamentos`, `/copiloto`, `/modo-fabrica` e `/empresa/editar`.

O build de produção fica em `dist/`. O Docker do repositório principal ainda monta `gestoria-main/frontend`, então a troca definitiva exige publicar este `dist` no mesmo domínio da API e configurar fallback para as rotas do React antes de remover o frontend legado.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
