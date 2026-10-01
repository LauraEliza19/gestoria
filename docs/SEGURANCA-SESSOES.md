# Sessões seguras e implantação em produção

Os READMEs existentes foram preservados. Este documento substitui os exemplos antigos de autenticação JWT e senha demo, sem modificar a apresentação do projeto.

## Mudanças

- JWT/Bearer foi substituído por uma sessão persistida no banco. O cookie contém um identificador aleatório de 256 bits; somente seu SHA-256 fica armazenado. O segredo não aparece no JSON nem no armazenamento JavaScript.
- Produção usa `__Host-gestoria_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`. Desenvolvimento HTTP usa `gestoria_session`, sem `Secure`.
- Cada acesso verifica sessão, usuário ativo, vínculo ativo e organização. As permissões existentes foram preservadas.
- O acesso vence em 30 minutos. Após um 401, o frontend renova a sessão e repete a requisição uma única vez. A renovação troca o identificador e invalida o anterior.
- O limite absoluto é de 12 horas ou 30 dias com “Manter conectado”. Renovação não estende esse prazo. Sem essa opção, o cookie não recebe `Max-Age`; alguns navegadores restauram cookies ao reabrir, mas o limite absoluto continua aplicado.
- Logout revoga no servidor e remove o cookie. Existe também logout de todas as sessões. Falhas ao sair são mostradas para permitir nova tentativa.
- Uma atualização condicional garante um único vencedor entre renovações simultâneas. O frontend compartilha a renovação em andamento e usa Web Locks para coordenar abas compatíveis.
- Login: 30 tentativas/IP e 10 tentativas/e-mail por janela fixa de 15 minutos, compartilhadas no banco entre workers. Sucessos também contam. Respostas 429 informam `Retry-After`. Janelas fixas permitem pico na virada da janela; ajuste os limites conforme o tráfego.
- Toda mutação em `/api/`, inclusive login/logout/refresh, exige `X-CSRF-Protection: 1`. Origem, quando presente, deve estar na lista explícita; `cross-site` é rejeitado. Essa estratégia pressupõe frontend/API na mesma origem e ausência de CORS permissivo.
- Cabeçalhos CSP, `nosniff`, `DENY`, Referrer-Policy, Permissions-Policy e `no-store` na API/HTML. HSTS em produção. A CSP permite os estilos inline da interface e Google Fonts, mas não scripts inline da aplicação. Documentação interativa recebe política própria somente em desenvolvimento.
- Produção recusa HTTP, hosts/origens indevidos, senha padrão do banco, chave de operações ausente, cookie inseguro e demo habilitado. Swagger/OpenAPI ficam desabilitados.

## Atualização do banco

A migração `0009_cookie_sessions`, após `0008_recipe_ingredients`, cria `auth_sessions` e `login_rate_limits`. O startup executa `alembic upgrade head` antes da API. Em execução manual, aplique a migração primeiro.

Faça backup e atualize frontend/backend juntos. Todos precisarão entrar novamente: JWTs antigos não são aceitos. A chave antiga `gestoria_token` é removida de localStorage/sessionStorage. Não é necessário converter tokens.

O downgrade desta revisão apaga sessões/contadores e encerra acessos, mas não apaga cadastros ou documentos fiscais. Reverter o código para uma versão antiga também reintroduz o mecanismo anterior.

## Desenvolvimento

O comando habitual continua sendo `docker compose up --build`. Nenhum demo é criado por padrão. Para criar o administrador:

```bash
docker compose exec api python -m app.create_admin
```

Para demo exclusivamente local, copie `.env.example` para `.env`, defina `DEMO_ENABLED=true` e escolha sua própria `DEMO_PASSWORD`. O startup cria o demo somente com essa opção explícita. Os scripts de demo e pitch recusam produção.

Sem Docker, use `APP_ENV=development`, configure `DATABASE_URL`, gere as chaves com `python scripts/configure_security.py`, compile o frontend e execute `alembic upgrade head` no backend. O proxy Vite continua usando `localhost:8000`.

## Produção com HTTPS

Use apenas `docker-compose.production.yml`, sem combinar com o Compose local. Caddy fornece TLS automático; somente 80/443 são publicadas. API e PostgreSQL ficam internos. O volume produtivo é separado: uma base existente precisa de backup/restauração explícitos.

1. Aponte um domínio real para o servidor e libere 80/443 para emissão do certificado.
2. Copie `.env.production.example` para `.env.production`; preencha `SITE_DOMAIN`.
3. Gere uma senha exclusiva e coloque em `POSTGRES_PASSWORD`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(36))"
```

Use os caracteres URL-safe gerados, pois a senha compõe a URL do banco. Se o volume já existe, alterar a variável não troca a senha no PostgreSQL: atualize banco e configuração de forma coordenada.

4. Gere a chave de assinatura das operações:

```bash
python scripts/configure_security.py --env .env.production
```

5. Inicie:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up --build -d
```

6. Crie o administrador real:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec api python -m app.create_admin
```

A senha não aparece no terminal e exige 12 caracteres. Para usar dados de uma empresa existente, informe seu identificador (`slug`) exato e confirme `VINCULAR` quando solicitado. O utilitário não modifica usuários existentes.

No startup produtivo, `admin@gestoria.dev`, `pitch@gestoria.dev`, o e-mail demo configurado e usuários chamados `Administrador Demo` são desativados, recebem senha aleatória inacessível e têm as sessões revogadas. Seus registros permanecem para preservar referências fiscais/auditoria. O login também os bloqueia se o startup for ignorado. Revise demos renomeados manualmente: o banco antigo não tem marcador universal para identificá-los.

O Dockerfile padrão assume produção e usa usuário sem privilégios. O Compose local sobrescreve explicitamente o ambiente. O proxy possui IP fixo `172.30.0.10`, único confiável para cabeçalhos encaminhados. Não use `--forwarded-allow-ips=*` nem publique a API diretamente. Se `172.30.0.0/24` conflitar com a infraestrutura, ajuste sub-rede, IP do Caddy e lista confiável juntos.

Arquivos `.env.*` reais são ignorados pelo Git e pelo build. Nenhum segredo real foi incluído. Troque credenciais anteriormente publicadas, inclusive se reutilizadas em outros serviços; remover do código não remove o histórico Git.

## API

| Rota | Comportamento |
| --- | --- |
| `POST /api/auth/login` | JSON `{email, password, remember}`; define cookie e retorna `access_expires_at`/`expires_at`. |
| `GET /api/auth/me` | Retorna usuário, organização e papel. |
| `POST /api/auth/refresh` | Renova e troca o cookie dentro do limite absoluto. |
| `POST /api/auth/logout` | Revoga a sessão, apaga cookie e retorna 204; idempotente. |
| `POST /api/auth/logout-all` | Exige acesso válido, revoga todas as sessões e retorna 204. |

Clientes HTTP precisam de cookie jar e `X-CSRF-Protection: 1` nas mutações. No navegador, use `credentials: 'same-origin'`. Não envie Bearer.

| Variável da API | Padrão |
| --- | --- |
| `SESSION_ACCESS_MINUTES` | 30 |
| `SESSION_HOURS` | 12 |
| `SESSION_REMEMBER_DAYS` | 30 |
| `LOGIN_WINDOW_SECONDS` | 900 |
| `LOGIN_IP_LIMIT` | 30 |
| `LOGIN_ACCOUNT_LIMIT` | 10 |

Para sobrescrever em Docker, inclua a variável no bloco `environment`; apenas escrevê-la no arquivo de interpolação do Compose não a injeta. Hosts/origens são arrays JSON e o Compose produtivo deriva ambos de `SITE_DOMAIN`.

Sessões expiradas são limpas ao criar sessões; janelas antigas são limpas ao processar login. Essas tabelas não são logs permanentes de auditoria.

## Validação e liberação

Os resultados deste pacote estão em `VALIDACAO-SEGURANCA.md`. Para executar também os testes PostgreSQL em ambiente descartável:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
```

Antes de liberar, confirme login HTTPS, cookie seguro, renovação, logout e bloqueio demo na infraestrutura real. Este pacote não foi implantado em produção.

Referências: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP HTTP Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html).
