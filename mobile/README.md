# GestorIA Mobile

Aplicativo executivo do GestorIA, construído com React Native, Expo e Expo Router. Ele consome a mesma API utilizada pela aplicação web e oferece uma experiência orientada a acompanhamento, prioridades e decisões rápidas.

## Estado atual

Funcionalidades disponíveis:

- autenticação e renovação de sessão integradas à API;
- painel executivo com indicadores e prioridades reais;
- central de alertas consolidada;
- Copiloto em modo controlado;
- consulta e acompanhamento de pedidos;
- catálogo de módulos;
- informações da conta, empresa e sessão;
- identidade visual Sereno compartilhada entre as telas principais.

No catálogo, apenas módulos com rota mobile implementada aparecem como **Disponível**. Os demais são identificados como **Em integração** e continuam acessíveis pela aplicação web.

## Tecnologias

- React Native 0.86;
- React 19;
- Expo 57;
- Expo Router;
- TypeScript;
- React Native Web para validação no navegador;
- ESLint e Node Test Runner.

## Organização

```text
mobile/
├── src/
│   ├── app/                 rotas do Expo Router
│   ├── components/serene/   composição visual compartilhada
│   ├── config/              configuração de ambiente
│   ├── features/            telas, hooks e serviços por domínio
│   ├── services/            cliente HTTP compartilhado
│   └── theme/               cores, espaçamento e tokens visuais
├── tests/                   contratos e testes da interface
└── package.json
```

## Configuração da API

Crie `mobile/.env.local` e informe uma URL que o dispositivo consiga acessar:

```dotenv
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:8000
```

Exemplos:

- navegador no mesmo computador: `http://localhost:8000`;
- Expo Go no celular: endereço IPv4 do computador na mesma rede, como `http://192.168.0.10:8000`;
- túnel: use a URL pública correspondente à API, nunca a URL do bundler Expo.

O backend também precisa aceitar a origem usada pelo Expo Web em `ALLOWED_ORIGINS`. Não coloque segredos, credenciais ou chaves privadas em variáveis `EXPO_PUBLIC_*`, pois elas são incorporadas ao aplicativo cliente.

## Executar

Com a API em funcionamento:

```powershell
cd mobile
npm ci
npx expo start
```

Opções úteis:

```powershell
npm run web
npm run android
npm run ios
npx expo start --web --clear
npx expo start --tunnel --clear
```

O simulador iOS nativo exige macOS. No Windows, a versão web em modo responsivo ou o Expo Go são as opções recomendadas para validar a experiência móvel.

## Qualidade

Execute a validação integrada:

```powershell
npm run check
```

Ou separadamente:

```powershell
npm run lint -- --no-cache
npm run typecheck
npm test
```

Os testes atuais verificam contratos do Copiloto, painel executivo e identidade visual Sereno. Eles não substituem a validação manual em aparelho real e no navegador responsivo.

## Sessão e segurança

- a autenticação usa cookie `HttpOnly` emitido pela API;
- requisições enviam credenciais e a proteção CSRF exigida pelo backend;
- a organização é determinada pela sessão autenticada;
- permissões e isolamento por empresa são validados pelo servidor;
- ações indisponíveis não são simuladas como concluídas;
- nenhuma chave de banco ou provedor externo deve existir no aplicativo.

## Identidade visual Sereno

O padrão visual utiliza cabeçalho escuro, folha clara de conteúdo, hierarquia tipográfica direta, linhas finas e cores de estado reservadas para significado operacional.

Ao criar uma tela:

1. reutilize os tokens em `src/theme/`;
2. utilize os componentes de `src/components/serene/`;
3. implemente carregamento, vazio, erro e sucesso;
4. respeite áreas seguras, teclado, rolagem e tamanho de toque;
5. não apresente como disponível uma integração ainda planejada.

## Próximas integrações

- clientes, produtos e orçamentos;
- produção e estoque;
- fiscal;
- financeiro;
- gestão interna;
- edição dos dados da empresa;
- notificações, biometria, câmera e leitura de código de barras após estabilização dos fluxos centrais.

Consulte também o [README principal](../README.md), o [Projeto de Interface](<../docs/entregaEtapa3/Projeto de Interface.md>) e o [contrato do Copiloto](../docs/COPILOTO-MVP.md).
