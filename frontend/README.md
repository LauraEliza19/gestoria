# Frontend — GestorIA

Interface em HTML, JavaScript (MVC) e Tailwind CSS. Não sobe um servidor próprio: o FastAPI entrega as páginas e os arquivos estáticos na porta **8000**.

## Organização (MVC)

```text
frontend/
  views/                         páginas (View)
    login.html
    dashboard.html
  static/
    css/
      input.css                  tokens e diretivas do Tailwind
      app.css                    CSS gerado (`npm run build`)
      dashboard.css              componentes do painel
    js/
      models/                    dados e API (Model)
        session.js               token JWT no storage
        api.js                   fetch autenticado
      views/                     apresentação (View)
        format.js                dinheiro, datas, escape HTML
        toast.js                 mensagens de feedback
      controllers/               eventos e orquestração (Controller)
        login.controller.js
        dashboard.controller.js
  package.json
```

- **Model** fala com `/api/*` e guarda a sessão.
- **View** desenha HTML e formata o que aparece na tela.
- **Controller** liga formulários, tabelas e navegação aos models.

Clientes, produtos e pedidos usam a API real. Orçamentos, relatórios, atividade e o chat de IA ainda são protótipos locais.

## Como executar

O caminho usual é o Docker na raiz do repositório (sobe API, banco e este frontend juntos):

```bash
cd ..
cp .env.example .env          # só na primeira vez
docker compose up --build
```

Abra:

- Aplicação: http://localhost:8000
- Painel (após login): http://localhost:8000/dashboard

E-mail: `admin@gestoria.dev`  
Senha: `GestorIA@123`

## CSS (Tailwind)

Depois de mudar classes nas views ou o `static/css/input.css`:

```bash
npm install
npm run build
```

Durante o desenvolvimento visual:

```bash
npm run watch
```

O painel também carrega `static/css/dashboard.css`. O login usa sobretudo o Tailwind compilado em `app.css`.

## Rotas servidas pelo backend

| URL | Arquivo |
| --- | --- |
| `/` | `views/login.html` |
| `/dashboard` | `views/dashboard.html` |
| `/static/...` | conteúdo de `static/` |
