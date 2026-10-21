# Especificação do Projeto

**Produto:** GestorIA

**Situação:** MVP acadêmico funcional em evolução

**Plataformas:** web, mobile e API

**Atualização desta revisão:** outubro de 2026

---

## 1. Objetivo

O GestorIA centraliza a operação de pequenas e médias empresas e transforma os dados em indicadores, alertas e decisões contextualizadas.

O sistema deve:

1. manter os dados de cada empresa isolados;
2. permitir operação detalhada pela aplicação web;
3. permitir acompanhamento executivo pelo aplicativo mobile;
4. preservar estoque, valores e documentos por meio de regras transacionais;
5. exigir permissão e confirmação em ações sensíveis;
6. oferecer um Copiloto controlado sem acesso direto do modelo ao banco;
7. registrar evidências suficientes para auditoria e evolução segura.

## 2. Escopo

### 2.1 Implementado

| Área | Estado | Responsabilidade |
|---|---|---|
| Autenticação e empresa | funcional | login, sessão, renovação, logout e perfil da organização |
| Clientes | funcional | cadastro, edição, exclusão permitida e histórico comercial |
| Produtos e estoque | funcional | catálogo, preço, saldo, mínimo e dados fiscais |
| Pedidos | funcional | proposta, confirmação, status, baixa e recomposição de estoque |
| Orçamentos | funcional | criação, validade, aprovação e conversão única |
| Dashboard executivo | funcional | indicadores e prioridades consolidados |
| Produção | funcional | ingredientes, estoque produtivo, receitas, disponibilidade e fila |
| Fiscal | funcional internamente | documentos, fornecedores, vínculos, eventos e recebimento |
| Financeiro | funcional no backend e web | categorias, lançamentos, filtros, entradas, saídas e saldo |
| Gestão interna | funcional no backend e web | funcionários, vínculos, centros de custo e ocorrências |
| Copiloto | MVP controlado | dez intenções mapeadas, uma consulta real e orientações seguras |
| Mobile | jornada executiva funcional | login, início, alertas, Copiloto, pedidos, módulos e conta |

### 2.2 Em evolução

- integração mobile de clientes, produtos, orçamentos, produção, estoque, fiscal, financeiro, gestão interna e empresa;
- ampliação das ferramentas reais do Copiloto;
- vínculo direto entre lançamentos financeiros e centros de custo;
- histórico geral de movimentações do estoque produtivo;
- paginação de listagens de maior volume;
- observabilidade, backup e entrega contínua;
- testes de uso com empresas-piloto.

### 2.3 Fora do escopo atual

- emissão, autorização e cancelamento reais de NF-e/NFC-e em serviço governamental;
- gateway de pagamento, assinatura e cobrança;
- provedor externo de IA em produção;
- execução de ações críticas pelo Copiloto;
- troca de organização na mesma sessão;
- integração com WhatsApp, e-mail transacional ou ERPs externos;
- publicação comercial do aplicativo em lojas;
- RLS no PostgreSQL e autenticação multifator.

## 3. Atores e permissões

| Papel | Capacidades gerais |
|---|---|
| `owner` | administração completa, dados sensíveis de vínculo e operações restritas |
| `admin` | cadastros e operação dos módulos, respeitando restrições exclusivas do proprietário |
| `member` | operação cotidiana nas rotas permitidas; Financeiro somente quando aprovado |
| visitante | acesso apenas ao fluxo de autenticação |

Regras:

- o backend é a autoridade final;
- esconder um botão não substitui autorização;
- toda consulta de negócio utiliza a organização da sessão;
- salário e compensação são restritos ao `owner`;
- Gestão Interna exige `owner` ou `admin`;
- criação e atualização financeira exigem `owner` ou `admin`.

## 4. Requisitos funcionais

### RF-01 — Autenticação e sessão

O sistema deve autenticar por e-mail e senha, criar sessão persistida revogável em cookie `HttpOnly`, expor a sessão atual, permitir renovação rotacionada, logout e encerramento de todas as sessões.

### RF-02 — Organização

O usuário autenticado deve consultar e atualizar apenas o perfil de sua empresa, incluindo identificação, contato e endereço.

### RF-03 — Clientes

O sistema deve listar, criar, editar e excluir clientes quando as regras permitirem. O perfil reúne dados cadastrais, categoria, desconto, endereço e histórico de consumo.

### RF-04 — Produtos e estoque comercial

O sistema deve manter produto, preço, quantidade, mínimo, categoria, tipo, unidade, perecibilidade e dados fiscais cadastrais. O estado exibido é derivado do saldo e da situação ativa.

### RF-05 — Criação protegida de pedidos

A criação ocorre em duas etapas:

1. preparação de proposta com chave de idempotência;
2. confirmação do envelope assinado pelo servidor.

A preparação não altera estoque. Na confirmação, pedido, itens, baixa de estoque, comprovante e auditoria são persistidos de forma transacional. A criação direta antiga permanece bloqueada.

### RF-06 — Ciclo de vida dos pedidos

Pedidos podem ficar em preparação, concluídos ou cancelados. Alterações devem validar as transições e ajustar o estoque uma única vez. Exclusões exigem papel autorizado.

### RF-07 — Orçamentos

Orçamentos preservam preços históricos, validade e situação. Apenas orçamento aprovado e vigente pode ser convertido em pedido, uma única vez.

### RF-08 — Dashboard e alertas

A API deve consolidar:

- vendas do dia;
- pedidos em preparação;
- receitas bloqueadas;
- estoque crítico;
- documentos fiscais que exigem atenção;
- funcionários ativos e ocorrências abertas, quando disponíveis;
- saldo financeiro, quando disponível;
- alertas com severidade, origem, impacto e rota de ação.

### RF-09 — Produção

O sistema deve cadastrar ingredientes, saldos e receitas, calcular disponibilidade, relacionar produtos vendidos a receitas, mostrar insumos por pedido e permitir consumo manual seguro.

### RF-10 — Fiscal

O módulo deve manter documentos de entrada e saída, fornecedores, itens, eventos, vínculos com pedidos, reemissão e recebimento de estoque. Autorização fiscal externa continua fora do escopo.

### RF-11 — Financeiro

O sistema deve manter categorias e lançamentos de entrada ou saída, com situação pendente, paga ou cancelada. Deve permitir filtros e calcular entradas realizadas, saídas realizadas e saldo com valores decimais.

### RF-12 — Gestão interna

O sistema deve manter funcionários, vínculos profissionais, centros de custo e registros administrativos. Ocorrências podem ser abertas, atualizadas, resolvidas ou canceladas conforme suas regras.

### RF-13 — Copiloto

O Copiloto deve:

- reconhecer as dez perguntas mapeadas;
- consultar pedidos em preparação por ferramenta real e isolada por empresa;
- orientar o usuário aos módulos nas demais intenções controladas;
- apresentar fonte, itens e ações quando disponíveis;
- respeitar permissões;
- não executar escrita crítica no MVP;
- não inventar dados ausentes.

### RF-14 — Aplicativo mobile

O mobile deve oferecer login, painel executivo, alertas, Copiloto, pedidos, catálogo de módulos e conta. Módulos sem rota funcional devem aparecer explicitamente como em integração.

## 5. Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-01 | isolamento multiempresa em toda consulta de negócio |
| RNF-02 | regras de negócio fora das rotas HTTP |
| RNF-03 | autenticação por cookie `HttpOnly`, sem token acessível ao JavaScript |
| RNF-04 | proteção CSRF em toda mutação da API |
| RNF-05 | idempotência e HMAC-SHA256 nas propostas de pedido |
| RNF-06 | transação e rollback em operações críticas |
| RNF-07 | `Decimal`/`Numeric` para valores monetários |
| RNF-08 | interface com carregamento, vazio, erro e sucesso |
| RNF-09 | TypeScript no frontend web e mobile |
| RNF-10 | migrations novas e versionadas |
| RNF-11 | logs e respostas sem segredos ou dados indevidos |
| RNF-12 | HTTPS, hosts e origens explícitos em produção |

## 6. Regras de negócio centrais

| Regra | Descrição |
|---|---|
| RN-01 | a organização é obtida da sessão |
| RN-02 | cliente, produto e entidades relacionadas devem pertencer à mesma empresa |
| RN-03 | estoque insuficiente bloqueia a operação sem escrita parcial |
| RN-04 | cancelamento de pedido recompõe estoque uma única vez |
| RN-05 | preços históricos de pedido e orçamento permanecem congelados |
| RN-06 | confirmação repetida devolve o resultado original |
| RN-07 | receita não cria automaticamente saldo de ingrediente |
| RN-08 | unidades incompatíveis não são convertidas |
| RN-09 | lançamento financeiro possui valor positivo e categoria da mesma empresa |
| RN-10 | compensação do vínculo profissional só pode ser consultada pelo proprietário |
| RN-11 | Copiloto nunca escolhe a organização nem acessa o banco diretamente |

## 7. Arquitetura

```text
Web React ─────┐
               ├── API FastAPI ── Services ── Repositories ── PostgreSQL
Mobile Expo ───┘          │
                          ├── autenticação e permissões
                          ├── transações e auditoria
                          └── ferramentas controladas do Copiloto
```

```text
gestoria/
├── backend/
│   ├── alembic/           migrations
│   ├── app/
│   │   ├── api/           rotas e dependências
│   │   ├── models/        entidades
│   │   ├── repositories/  persistência
│   │   ├── schemas/       contratos
│   │   └── services/      regras e transações
│   └── tests/
├── frontend/
│   ├── src/app/           entrada e roteamento
│   ├── src/pages/         páginas por domínio
│   ├── src/services/      cliente da API
│   └── tests/
├── mobile/
│   ├── src/app/           rotas Expo
│   ├── src/features/      funcionalidades
│   ├── src/components/    componentes compartilhados
│   └── tests/
├── docs/
├── deploy/
└── docker-compose*.yml
```

Em produção, o frontend compilado é servido pela aplicação FastAPI com fallback para as rotas React. No desenvolvimento, Vite e Expo podem executar separadamente e consumir a mesma API.

## 8. Modelo de dados — visão consolidada

| Grupo | Entidades principais |
|---|---|
| identidade | `organizations`, `users`, `organization_members`, `auth_sessions` |
| comercial | `customers`, `products`, `orders`, `order_items`, `quotes`, `quote_items` |
| segurança de pedidos | `order_operations`, `order_audit_events` |
| produção | ingredientes, itens de estoque, receitas e ingredientes de receita |
| fiscal | documentos, itens, fornecedores e eventos fiscais |
| gestão interna | funcionários, vínculos, centros de custo e registros |
| financeiro | categorias, lançamentos e eventos de auditoria |

As chaves e constraints devem impedir associações entre organizações. O uso de `organization_id` nos relacionamentos sensíveis reforça essa regra.

## 9. Interfaces

### Web

Rotas principais: `/dashboard`, `/clientes`, `/produtos`, `/pedidos`, `/orcamentos`, `/modo-fabrica`, `/notas-fiscais`, `/financeiro`, `/gestao`, `/empresa/editar` e `/copiloto`.

### Mobile

A barra principal utiliza:

1. Início;
2. Alertas;
3. Copiloto;
4. Módulos;
5. Conta.

Pedidos possui rota funcional contextual. Os outros módulos permanecem identificados como em integração.

## 10. API

| Prefixo | Uso |
|---|---|
| `/api/auth` | sessões |
| `/api/organization` | empresa |
| `/api/dashboard` | visão executiva |
| `/api/customers` | clientes |
| `/api/products` | produtos |
| `/api/orders` | pedidos e operações protegidas |
| `/api/quotes` | orçamentos |
| `/api/production` | produção e estoque produtivo |
| `/api/fiscal-documents` | documentos fiscais |
| `/api/fiscal-suppliers` | fornecedores |
| `/api/finance` | financeiro |
| `/api/management` | gestão interna |
| `/api/copilot` | Copiloto |
| `/api/health` | saúde |

Em desenvolvimento, o contrato detalhado pode ser consultado em `/docs`. Em produção, OpenAPI, Swagger e ReDoc ficam desabilitados.

## 11. Segurança

- Argon2 para senhas;
- identificador aleatório de sessão e somente seu hash no banco;
- cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- sessão rotacionada na renovação;
- limite de tentativas de login compartilhado no banco;
- cabeçalho `X-CSRF-Protection: 1` em mutações;
- validação de origem;
- HMAC-SHA256 e idempotência para propostas de pedido;
- autorização por papel e permissões específicas;
- auditoria nos domínios protegidos;
- HTTPS e rede interna do banco na composição de produção.

## 12. Tecnologias

| Camada | Tecnologias |
|---|---|
| Web | React 19, TypeScript, Vite, Tailwind CSS 4 e React Router |
| Mobile | React Native, Expo, Expo Router e TypeScript |
| API | Python 3.12, FastAPI e Pydantic |
| Persistência | PostgreSQL 17, SQLAlchemy 2 e Alembic |
| Infraestrutura | Docker, Docker Compose e Caddy |
| Qualidade | Pytest, Ruff, Node Test Runner, ESLint/Oxlint, Prettier e TypeScript |

## 13. Ambiente de execução

```powershell
git clone https://github.com/LauraEliza19/gestoria.git
cd gestoria
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose run --rm security-init
docker compose up -d --build
docker compose exec api python -m app.create_admin
```

- web e API: `http://localhost:8000`;
- Swagger de desenvolvimento: `http://localhost:8000/docs`;
- mobile: configurar `EXPO_PUBLIC_API_URL` e executar dentro de `mobile/`.

Não utilize `docker compose down -v` quando precisar preservar o banco local.

## 14. Qualidade e aceite

Critérios mínimos:

1. sessão válida abre somente dados da empresa autenticada;
2. mutações sem proteção CSRF são rejeitadas;
3. confirmação repetida de pedido não duplica operação;
4. estoque insuficiente não produz escrita parcial;
5. orçamento aprovado e vigente converte uma única vez;
6. produção calcula disponibilidade e faltas;
7. documentos fiscais preservam vínculos e histórico;
8. financeiro calcula saldo apenas com lançamentos realizados;
9. dados sensíveis de vínculos respeitam permissões;
10. dashboard e alertas refletem dados atuais;
11. Copiloto consulta somente ferramentas autorizadas;
12. web e mobile passam pelas verificações de lint, tipos e testes aplicáveis.

## 15. Roadmap

- [x] autenticação por sessões persistidas e isolamento entre empresas;
- [x] clientes, produtos, pedidos e orçamentos;
- [x] dashboard executivo e alertas;
- [x] produção e disponibilidade por receita;
- [x] documentos fiscais internos;
- [x] Gestão Interna e ocorrências;
- [x] Financeiro no backend e web;
- [x] Copiloto controlado com primeira ferramenta real;
- [x] experiência executiva mobile e pedidos;
- [ ] ampliar ferramentas reais do Copiloto;
- [ ] integrar todos os módulos ao mobile;
- [ ] vincular lançamentos a centros de custo;
- [ ] integrar emissão fiscal externa;
- [ ] adicionar observabilidade, backup e entrega contínua;
- [ ] realizar testes de uso com empresas-piloto.

## 16. Glossário

| Termo | Significado |
|---|---|
| tenant | empresa proprietária dos dados |
| painel executivo | resumo de indicadores e alertas para decisão |
| proposta/envelope | documento assinado que antecede a criação do pedido |
| Modo Fábrica | experiência web de produção |
| Copiloto controlado | reconhecimento de intenções e ferramentas explicitamente permitidas |
| Sereno | identidade visual principal do aplicativo mobile |

## 17. Referências

- [README](README.md);
- [Arquitetura do Sistema](<docs/entregaEtapa3/Arquitetura do Sistema.md>);
- [Projeto de Interface](<docs/entregaEtapa3/Projeto de Interface.md>);
- [Sessões seguras](docs/SEGURANCA-SESSOES.md);
- [Segurança de pedidos](docs/SEGURANCA_PEDIDOS.md);
- [Copiloto MVP](docs/COPILOTO-MVP.md);
- [Produção e cozinha](docs/PRODUCAO_COZINHA.md);
- [Fiscal](docs/FISCAL_ATUALIZACOES_E_TESTES.md);
- [Gestão Interna](docs/GESTAO-INTERNA.md).
