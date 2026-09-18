# Especificação do Projeto

**Produto:** GestorIA  
**Versão de referência:** 0.2.0-security.1 (MVP em evolução)  
**Data:** setembro de 2026  
**Documento de contexto:** [Documento de Contexto.md](Documento%20de%20Contexto.md)

Este documento especifica o que o sistema deve fazer, as regras que não podem quebrar e como as partes se encaixam. Não substitui o contrato detalhado das operações protegidas em [docs/SEGURANCA_PEDIDOS.md](docs/SEGURANCA_PEDIDOS.md).

---

## 1. Objetivo

Entregar uma plataforma web na qual uma empresa autentica sua equipe, registra a operação (clientes, produtos, estoque, pedidos e orçamentos) e vê prioridades calculadas a partir dos dados reais — com isolamento entre empresas e integridade transacional nas vendas.

Objetivos específicos:

1. Permitir login, sessão JWT e papéis `owner`, `admin` e `member`.
2. Manter cadastros de organização, clientes e produtos com dados comerciais e de endereço.
3. Criar pedidos somente após proposta assinada, confirmação e verificação de estoque.
4. Criar orçamentos com preço histórico, validade e conversão única em pedido.
5. Exibir no dashboard indicadores reais e o Radar de prioridades.
6. Oferecer o Modo Fábrica para acompanhar e concluir a produção.
7. Evoluir o Copiloto até consultar dados e executar ações **somente com confirmação**.

## 2. Escopo

### 2.1 Dentro do escopo (implementado ou em evolução)

| Módulo | Estado | Responsabilidade |
| --- | --- | --- |
| Autenticação e empresa | Operacional | Login, sessão, perfil da organização |
| Clientes | Operacional | Cadastro, edição, exclusão e histórico de consumo |
| Produtos e estoque | Operacional | Catálogo, quantidade, mínimo, status derivado |
| Pedidos | Operacional | Fluxo de status, baixa/reposição de estoque, proteção da criação |
| Orçamentos | Operacional | Criação, aprovação, validade, conversão única |
| Dashboard e Radar | Operacional | Indicadores e prioridades a partir da API |
| Modo Fábrica | Operacional | Pedidos em produção, conclusão e consulta de insumos |
| Segurança de pedidos | Operacional | HMAC, idempotência, comprovante e auditoria |
| Copiloto | Em evolução | Interface pronta; inteligência e execução pendentes |
| Relatórios | Em evolução | Parte dos indicadores ainda pode usar dados simulados |
| Notas fiscais | Registro persistido | Vínculos com pedidos, fornecedores, itens, eventos e recebimento; emissão externa pendente |

### 2.2 Fora do escopo atual

- Emissão, autorização ou cancelamento de NF-e / NFC-e.
- Gateway de pagamento, planos e cobrança.
- Aplicativo nativo iOS/Android.
- Integração com WhatsApp, e-mail transacional ou ERPs externos.
- Multi-filial com troca de empresa na mesma sessão.
- Orquestrador de IA em produção.

## 3. Atores e papéis

| Papel | Pode |
| --- | --- |
| `owner` | Tudo do `admin`, inclusive exclusões sensíveis e eventos de segurança da empresa |
| `admin` | Operar cadastros, pedidos e orçamentos; excluir registros quando a regra permitir |
| `member` | Operar o dia a dia (criar e atualizar no que a API autorizar); vê só os próprios eventos de auditoria nas rotas restritas |
| Visitante | Apenas a tela de login |

O tenant é resolvido pela **sessão autenticada**, nunca por um `organization_id` enviado no corpo da criação de pedido.

## 4. Requisitos funcionais

### RF-01 Autenticação

O sistema deve autenticar o usuário por e-mail e senha, devolver um JWT e expor a sessão corrente em `/api/auth/me`. Senhas são armazenadas com Argon2.

### RF-02 Organização

O usuário autenticado deve consultar e atualizar o perfil da própria empresa (identificação fiscal, contato e endereço).

### RF-03 Clientes

O sistema deve listar, criar, editar e excluir clientes da empresa. Campos relevantes: tipo de pessoa, documento, contato, categoria comercial (`final_consumer`, `reseller`, `event`), desconto padrão, observações e endereço. O telefone é único por empresa. Não se exclui cliente com pedido vinculado.

### RF-04 Produtos e estoque

O sistema deve manter o catálogo com preço, quantidade, estoque mínimo, categoria, tipo (`manufactured` / `resale`), unidade (`unit`, `kg`, `g`), perecibilidade e campos fiscais cadastrais (NCM, CEST, origem) sem cálculo tributário. O status exibido é derivado: Inativo, Esgotado, Estoque baixo ou Disponível.

### RF-05 Pedidos — criação protegida

A criação de um pedido deve ocorrer em duas etapas:

1. **Preparar** uma proposta (`POST /api/orders/proposals`) com chave de idempotência.
2. **Confirmar** devolvendo o envelope assinado pelo servidor.

O estoque não é reservado na preparação. Na confirmação, pedido, baixa de estoque, comprovante e evento de auditoria entram na mesma transação. A rota antiga `POST /api/orders` responde **428** para novas criações.

### RF-06 Pedidos — ciclo de vida

Status permitidos: `in_preparation`, `completed`, `cancelled`. Transições:

- `in_preparation` → `completed` ou `cancelled`
- `completed` → `cancelled`
- `cancelled` → `in_preparation` (revalida estoque)

Cancelar recompõe o estoque. Excluir pedido exige `owner` ou `admin`.

### RF-07 Orçamentos

O orçamento não baixa estoque. Os preços dos itens são congelados na criação. Status: `pending`, `approved`, `rejected`, `converted`. Orçamento vencido não pode ser aprovado nem convertido. Só orçamento **aprovado e vigente** vira pedido, uma única vez, reusando os preços históricos.

### RF-08 Radar e dashboard

A visão geral deve calcular prioridades com dados atuais: pedidos em produção, estoque crítico e orçamentos próximos do vencimento. Atalhos (novo pedido, novo orçamento, produtos, fábrica) abrem os fluxos já existentes. O atalho de novo pedido usa a mesma confirmação protegida.

### RF-09 Modo Fábrica

A tela `/modo-fabrica` deve listar pedidos em preparo e concluídos, permitir busca, atualizar status de produção e consultar insumos.

### RF-10 Copiloto

A rota `/copiloto` deve oferecer a experiência de assistência. Enquanto a IA não estiver integrada, nenhuma ação de escrita pode ser executada sem o mesmo contrato de confirmação previsto para pedidos.

### RF-11 Comprovante e auditoria

O usuário deve recuperar o comprovante da operação executada. Eventos `prepared`, `executed`, `rejected` e `cancelled` são persistidos. `owner`/`admin` listam os eventos da empresa; `member` lista os próprios.

## 5. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Isolamento multi-tenant em todas as consultas de negócio |
| RNF-02 | API sem SQL nas rotas; regras nos services; persistência nos repositories |
| RNF-03 | Frontend sem credenciais de banco; autenticação só via Bearer token |
| RNF-04 | Criação de pedido idempotente (mesma chave + mesmos dados = mesma operação) |
| RNF-05 | HMAC-SHA256 do envelope; o cliente nunca calcula a assinatura nem recebe a chave |
| RNF-06 | Falha em qualquer etapa da confirmação desfaz pedido e estoque (rollback) |
| RNF-07 | Proposta com TTL configurável (`OPERATION_TTL_SECONDS`, padrão 300) |
| RNF-08 | Respostas das rotas protegidas com `Cache-Control: no-store` |
| RNF-09 | Valores monetários com duas casas e `ROUND_HALF_UP`; quantidades com até três casas |
| RNF-10 | Subida local via Docker Compose; testes automatizados no backend (Pytest) |
| RNF-11 | Interface utilizável em desktop; Modo Fábrica pensado para tela de produção |
| RNF-12 | Sem a chave de operação configurada, as rotas protegidas respondem 503 |

## 6. Regras de negócio

| ID | Regra |
| --- | --- |
| RN-01 | Preço de venda do item de pedido ou orçamento vem do cadastro (ou do preço histórico, na conversão), nunca do cliente HTTP |
| RN-02 | Estoque insuficiente gera conflito (409) e não grava nada |
| RN-03 | Cliente ou produto inativo / de outra empresa não entra na operação |
| RN-04 | Nome, unidade e preço exibidos na proposta precisam continuar iguais na confirmação |
| RN-05 | Itens repetidos na mesma proposta são agrupados e normalizados para o hash |
| RN-06 | Até 100 linhas por solicitação; quantidade acumulada de um produto ≤ 1.000.000 |
| RN-07 | Mesma chave de idempotência com dados diferentes = 409 |
| RN-08 | Repetir a confirmação de uma operação já executada devolve o resultado original (200), mesmo se o pedido tiver sido excluído depois |
| RN-09 | Uma chave nova é outra intenção e pode gerar outro pedido |
| RN-10 | Orçamento convertido não muda mais de status |
| RN-11 | Total gasto do cliente soma apenas pedidos `completed` |
| RN-12 | Exclusão de cliente, produto ou pedido: `owner` ou `admin` |
| RN-13 | O Copiloto não inventa campo que a mensagem não trouxe |

## 7. Arquitetura

```text
Interface web  →  FastAPI  →  Services  →  Repositories  →  PostgreSQL
                     ↓
              Assinatura HMAC, idempotência e auditoria
```

```text
gestoria/
├── backend/
│   ├── alembic/           migrações
│   ├── app/
│   │   ├── api/           rotas HTTP
│   │   ├── models/        entidades
│   │   ├── repositories/  persistência
│   │   ├── schemas/       validação Pydantic
│   │   └── services/      regras de negócio
│   └── tests/
├── frontend/
│   ├── views/             páginas
│   └── static/            CSS e JavaScript (MVC)
├── docs/
└── docker-compose.yml
```

O FastAPI serve a API em `/api/*` e as páginas HTML (`/`, `/dashboard`, `/copiloto`, `/modo-fabrica`, formulários). Não há servidor frontend separado.

## 8. Modelo de dados (visão)

| Entidade | Função |
| --- | --- |
| `organizations` | Empresa (tenant), dados fiscais e endereço |
| `users` | Conta de acesso |
| `organization_members` | Vínculo usuário–empresa e papel |
| `customers` | Cliente da empresa |
| `products` | Produto, estoque e atributos de catálogo |
| `orders` / `order_items` | Pedido e itens com preço congelado |
| `quotes` / `quote_items` | Orçamento, validade e itens |
| `order_operations` | Proposta/confirmação, envelope, comprovante, idempotência |
| `order_audit_events` | Trilha autenticada das operações protegidas |

Relacionamentos críticos:

- Pedido e orçamento exigem cliente da mesma empresa (`ON DELETE RESTRICT`).
- Item de pedido/orçamento referencia produto (`ON DELETE RESTRICT`).
- `quotes.converted_order_id` aponta para o pedido gerado, se houver.

## 9. Interfaces

| Rota de página | Destino |
| --- | --- |
| `/` | Login |
| `/dashboard` | Painel (visão geral, clientes, produtos, pedidos, orçamentos, notas, relatórios, atividade, perfil) |
| `/copiloto` | Assistente |
| `/modo-fabrica` | Produção |
| `/clientes/novo` | Formulário de cliente |
| `/produtos/novo` | Formulário de produto |
| `/empresa/editar` | Formulário da organização |

Identidade visual de referência: navy `#0B1330`, índigo `#131B4A`, azul `#3D63F5`, fundo `#F7F8FC`; tipografia Space Grotesk / Inter. Tema claro e escuro com persistência no `localStorage`.

## 10. API

Autenticação: `Authorization: Bearer <token>`.

| Método | Rota | Uso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autenticar |
| `GET` | `/api/auth/me` | Sessão atual |
| `GET` / `PATCH` | `/api/organization` | Perfil da empresa |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/customers` | Clientes |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/products` | Produtos |
| `GET` / `PATCH` / `DELETE` | `/api/orders` | Listar e ciclo de vida |
| `POST` | `/api/orders` | Bloqueado (428) na criação direta |
| `POST` | `/api/orders/proposals` | Preparar proposta (`Idempotency-Key`) |
| `GET` | `/api/orders/proposals/{id}` | Recuperar proposta |
| `POST` | `/api/orders/proposals/{id}/confirm` | Confirmar |
| `POST` | `/api/orders/proposals/{id}/cancel` | Descartar proposta |
| `GET` | `/api/orders/proposals/{id}/receipt` | Comprovante |
| `GET` | `/api/orders/security/events` | Auditoria |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/quotes` | Orçamentos |
| `POST` | `/api/quotes/{id}/convert` | Converter em pedido |
| `GET` | `/api/health` | Disponibilidade |

Códigos relevantes das rotas protegidas: 401 sessão inválida; 403 assinatura ou contexto inválido; 409 conflito / estoque / chave reutilizada com outros dados; 410 proposta expirada ou cancelada; 422 contrato inválido; 428 criação direta; 503 chave de assinatura ausente.

Documentação interativa: `http://localhost:8000/docs`.

## 11. Segurança

- Senha: Argon2. Sessão: JWT.
- Operações protegidas: HMAC-SHA256 sobre o envelope (exceto o campo `signature`); `input_hash` SHA-256 da proposta de negócio; chaveiro com `key_id` e rotação.
- O frontend guarda só a referência da proposta em `sessionStorage` para recuperar a revisão na mesma aba. Não armazena a chave HMAC.
- Eventos de auditoria não gravam senha, token nem payload adulterado recebido do cliente.
- `scripts/configure_security.py` (serviço `security-init` no Compose) gera a chave local. Sem ela, as rotas protegidas não operam.

Detalhes, limites e roteiro de teste: [docs/SEGURANCA_PEDIDOS.md](docs/SEGURANCA_PEDIDOS.md).

## 12. Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5, JavaScript (MVC), Tailwind CSS |
| API | Python 3.12, FastAPI |
| Persistência | PostgreSQL 17, SQLAlchemy 2 |
| Migrações | Alembic |
| Autenticação | JWT, Argon2 |
| Integridade operacional | HMAC-SHA256, idempotência, auditoria |
| Infraestrutura | Docker, Docker Compose |
| Qualidade | Pytest, Ruff |

## 13. Ambiente de execução

Pré-requisitos: Git e Docker Desktop (ou Docker Engine + Compose).

```bash
test -f .env || cp .env.example .env
docker compose run --rm security-init
docker compose up -d --build
```

| Serviço | Endereço |
| --- | --- |
| Aplicação | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Saúde | http://localhost:8000/api/health |

Usuário de demonstração (somente desenvolvimento): `admin@gestoria.dev` / `GestorIA@123`.

Não usar `docker compose down -v` se for preciso preservar o volume do PostgreSQL.

## 14. Qualidade e aceite

A suíte de backend cobre autenticação, CRUD, isolamento de tenant, estoque, orçamentos, transições de status, concorrência das operações protegidas e migrations.

Critérios mínimos de aceite do MVP atual:

1. Login com o usuário demo abre o dashboard com dados da API.
2. Cliente e produto cadastrados aparecem nas listagens da própria empresa e não vazam para outra.
3. Revisar pedido não altera estoque; confirmar altera uma vez; repetir a confirmação não duplica o pedido.
4. Estoque insuficiente na confirmação não cria pedido.
5. Orçamento aprovado e vigente converte uma vez, com os preços históricos; vencido recusa conversão.
6. Radar reflete pedido em produção, estoque crítico e orçamento próximo do vencimento.
7. Modo Fábrica lista e conclui pedidos em preparo.
8. `GET /api/health` responde `{"status":"ok"}`.

## 15. Roadmap

- [x] Autenticação e isolamento entre empresas
- [x] Clientes, produtos e estoque
- [x] Pedidos transacionais e orçamentos com conversão única
- [x] Radar com dados reais e Modo Fábrica
- [x] Confirmação, idempotência e auditoria da criação de pedidos
- [ ] Tornar o Copiloto funcional (consulta + ações com confirmação)
- [ ] Substituir indicadores ainda simulados por dados reais
- [ ] Integração fiscal no backend
- [ ] Testes automatizados do frontend
- [ ] Estender a camada protegida à conversão de orçamentos
- [ ] Ampliar validação de concorrência no PostgreSQL

## 16. Glossário

| Termo | Significado |
| --- | --- |
| Radar GestorIA | Lista de prioridades calculada com pedidos, estoque e orçamentos atuais |
| Copiloto | Interface de assistência; no futuro, camada de linguagem natural sobre os módulos |
| Proposta / envelope | Documento assinado pelo servidor que a pessoa confirma para criar o pedido |
| Modo Fábrica | Tela de produção em tempo real |
| Tenant | Empresa dona dos dados; isolada das demais |


## Atualização fiscal de 17/09/2026

A descrição fiscal anterior foi complementada pela revisão `0006_fiscal_integrity`. O frontend atual usa React/TypeScript; saídas exigem pedido e entradas possuem fornecedor e recebimento de estoque separado. Consulte [o relatório fiscal](docs/FISCAL_ATUALIZACOES_E_TESTES.md) para o modelo atualizado, exceções históricas, regras de reemissão e testes. A autorização real depende de integração externa.
