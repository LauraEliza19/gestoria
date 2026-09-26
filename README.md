[Plano de Negocios GestorIA.md](https://github.com/user-attachments/files/32687183/Plano.de.Negocios.GestorIA.md)# GestorIA

Plataforma de gestão empresarial com uma experiência orientada por inteligência artificial. O projeto está em desenvolvimento acadêmico com estrutura de aplicação real, backend em camadas, persistência PostgreSQL e isolamento dos dados de cada empresa.

## Estado atual do MVP

- Autenticação com senha protegida por Argon2 e sessão JWT.
- Usuários vinculados a empresas por papéis (`owner`, `admin` e `member`).
- CRUD manual de produtos com catálogo completo, custo, estoque, validade e dados fiscais.
- CRUD manual de clientes com dados pessoais, contato, endereço, desconto e telefone normalizado.
- Pedidos com múltiplos produtos, preço histórico, baixa transacional e recomposição de estoque em cancelamentos/exclusões.
- Total gasto do cliente calculado a partir dos pedidos concluídos.
- Isolamento multi-tenant em todas as consultas de negócio.
- Migrations versionadas com Alembic e testes automatizados da API.
- Radar operacional com prioridades e indicadores calculados a partir de clientes, produtos, pedidos e orçamentos; página do Copiloto migrada para React.

Orçamentos e dados cadastrais da empresa já usam a API. Relatórios e interpretação por IA ainda têm partes simuladas. O histórico visual antigo permanece local; os eventos de segurança de pedidos agora são persistidos e consultáveis pela API.

A criação direta de pedidos exige proposta assinada e confirmação. Consulte [atualizações e teste/uso](docs/SEGURANCA_PEDIDOS.md) para o contrato, limites e resultados de validação.

- HMAC-SHA256 com chave exclusiva do servidor, proposta com validade e idempotência.
- Pedido, estoque, comprovante e auditoria confirmados na mesma transação.
- Rota antiga de criação responde HTTP 428; conversão de orçamento mantém seu fluxo existente e está fora deste primeiro escopo criptográfico.

## Atualização fiscal — setembro/2026

Notas de saída agora exigem pedido da mesma empresa, com destinatário, itens e valores conferidos no servidor. Cancelamentos preservam o histórico; apenas uma saída ativa é permitida por pedido. Entradas usam fornecedor e recebimento de estoque explícito.

Leia [o mapeamento, as regras, a migração e o roteiro de testes](docs/FISCAL_ATUALIZACOES_E_TESTES.md) antes de atualizar um banco existente. A nova revisão é `0006_fiscal_integrity`; o registro de eventos externos não constitui emissão ou autorização pela SEFAZ.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 e Lucide React |
| API | Python 3.12 e FastAPI |
| Persistência | PostgreSQL 17 e SQLAlchemy 2 |
| Migrations | Alembic |
| Autenticação | JWT e Argon2 |
| Ambiente | Docker Compose |
| Qualidade | Pytest e Ruff |

## Executar com Docker

Requisito: Docker Desktop aberto.

No PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose run --rm security-init
docker compose up -d --build
```

No Linux ou macOS:

```bash
test -f .env || cp .env.example .env
docker compose run --rm security-init
docker compose up -d --build
```

Na inicialização, o projeto aplica automaticamente todas as migrations e prepara o usuário de demonstração. Acesse:

- Aplicação: `http://localhost:8000`
- Documentação da API: `http://localhost:8000/docs`
- E-mail: `admin@gestoria.dev`
- Senha: `GestorIA@123`

As credenciais são exclusivas do ambiente de desenvolvimento e podem ser alteradas no `.env`.

> Não execute `docker compose down -v` se quiser preservar os registros do PostgreSQL local. A opção `-v` remove o volume do banco.

## Estrutura do banco

| Tabela | Responsabilidade |
| --- | --- |
| `organizations` | Empresas atendidas pela plataforma |
| `users` | Identidade e credenciais dos usuários |
| `organization_members` | Papel do usuário em cada empresa |
| `products` | Catálogo e estoque isolados por empresa |
| `customers` | Clientes isolados por empresa |
| `orders` | Cabeçalho, cliente, status e total do pedido |
| `order_items` | Produtos, quantidades e preços históricos do pedido |
| `order_operations` | Propostas assinadas, idempotência e comprovantes históricos |
| `order_audit_events` | Eventos autenticados de preparação, execução, rejeição e cancelamento |
| `fiscal_documents` | Notas vinculadas, evidências e datas fiscais |
| `fiscal_document_items` | Itens e valores capturados para o histórico |
| `fiscal_events` | Ações fiscais com usuário responsável |
| `suppliers` | Fornecedores de notas de entrada |
| `fiscal_stock_movements` | Recebimentos e estornos de entrada |

O `organization_id` delimita os dados de cada empresa. Pedidos são gravados em uma única transação: se qualquer produto não existir ou não tiver estoque suficiente, nenhuma alteração é persistida.

Os índices da migration `0003` otimizam as consultas mais usadas pelo painel: listagem cronológica, busca de clientes, pedidos por cliente e filtros por status.

## Conferir os clientes no PostgreSQL

```powershell
docker compose exec db psql -U gestoria -d gestoria
```

No `psql`:

```sql
SELECT c.id, c.name, c.phone, c.created_at, o.name AS organization
FROM customers AS c
JOIN organizations AS o ON o.id = c.organization_id
ORDER BY c.created_at DESC;
```

Os registros exibidos na tela de Clientes vêm de `GET /api/customers`; não existe uma lista fixa no frontend. Saia do terminal com `\q`.

## Rotas implementadas

| Método | Rota | Uso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autenticar usuário |
| `GET` | `/api/auth/me` | Consultar a sessão atual |
| `GET` | `/api/products` | Listar produtos da empresa |
| `POST` | `/api/products` | Cadastrar produto |
| `PATCH` | `/api/products/{id}` | Editar produto |
| `DELETE` | `/api/products/{id}` | Excluir produto sem vínculos |
| `GET` | `/api/customers` | Listar clientes com total gasto |
| `POST` | `/api/customers` | Cadastrar cliente |
| `PATCH` | `/api/customers/{id}` | Editar cliente |
| `DELETE` | `/api/customers/{id}` | Excluir cliente sem pedidos |
| `GET` | `/api/orders` | Listar pedidos com seus itens |
| `POST` | `/api/orders` | Criação antiga bloqueada com HTTP 428 |
| `POST` | `/api/orders/proposals` | Preparar proposta assinada, sem alterar estoque |
| `POST` | `/api/orders/proposals/{id}/confirm` | Confirmar proposta e registrar pedido uma única vez |
| `POST` | `/api/orders/proposals/{id}/cancel` | Descartar proposta pendente |
| `GET` | `/api/orders/proposals/{id}/receipt` | Consultar comprovante verificado |
| `GET` | `/api/orders/security/events` | Consultar eventos autorizados e sua integridade |
| `PATCH` | `/api/orders/{id}` | Atualizar o status do pedido |
| `DELETE` | `/api/orders/{id}` | Excluir pedido sem histórico fiscal e recompor estoque como owner/admin |
| `GET` | `/api/fiscal-documents` | Listar e filtrar documentos fiscais |
| `POST` | `/api/fiscal-documents` | Registrar saída por pedido ou entrada por fornecedor/itens |
| `PATCH` | `/api/fiscal-documents/{id}` | Registrar transição permitida com evidência externa |
| `DELETE` | `/api/fiscal-documents/{id}` | Exclusão bloqueada (409), histórico preservado |
| `GET` | `/api/fiscal-documents/{id}` | Consultar detalhes e eventos |
| `POST` | `/api/fiscal-documents/{id}/link-order` | Conciliar saída histórica |
| `POST` | `/api/fiscal-documents/{id}/receive` | Confirmar recebimento de entrada uma única vez |
| `GET/POST` | `/api/fiscal-suppliers` | Listar/cadastrar fornecedores |
| `PATCH` | `/api/fiscal-suppliers/{id}` | Ativar/desativar fornecedor |
| `GET` | `/api/health` | Verificar a disponibilidade da API |

## Organização

O backend segue arquitetura em camadas. O frontend usa React com TypeScript, React Router e Tailwind CSS.

```text
frontend/
  src/
    app/                  roteamento e composição da aplicação
    layouts/              layouts autenticado e de navegação
    pages/                telas React por domínio
    services/             cliente HTTP e autenticação
    styles/               entrada Tailwind e tokens visuais
  dist/                   build de produção gerado pelo Vite

backend/
  alembic/               migrations versionadas do banco
  app/
    api/                 controllers HTTP (rotas)
    models/              tabelas e relacionamentos SQLAlchemy
    schemas/             validação de entrada e saída
    repositories/        consultas e persistência
    services/            autenticação e regras transacionais
    security.py          senha e token
    seed.py              dados iniciais de desenvolvimento
  tests/                 testes de API, transações e isolamento
```

As regras transacionais ficam nos services e as consultas fiscais principais nos repositories. O frontend nunca recebe credenciais do banco.

Para regenerar o build Tailwind/React depois de alterar componentes:

```bash
cd frontend
npm install
npm run build
```

## Testes e qualidade

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest -q
ruff check app tests alembic\versions
```

Os testes locais usam SQLite temporário com chaves estrangeiras ativadas. Para validar também migrations e concorrência no PostgreSQL 17, use `docker compose -p gestoria-fiscal-tests -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests`. Consulte os resultados e limites no relatório fiscal.

## Evoluir o schema

Depois de alterar os modelos, gere uma nova migration em vez de editar uma migration que já foi aplicada:

```powershell
docker compose exec api alembic revision --autogenerate -m "descricao da alteracao"
docker compose exec api alembic upgrade head
```

Antes de qualquer implantação pública, altere `JWT_SECRET`, senha do PostgreSQL e credenciais de demonstração.


[Uplo# Plano de Negócios — GestorIA

## 1. Identificação do negócio

**Nome:** GestorIA  
**Tipo de negócio:** Software como Serviço (SaaS) para gestão empresarial  
**Modelo de receita:** Assinatura mensal por empresa, com possibilidade de cobrança anual e recursos adicionais  
**Mercado-alvo:** Pequenas e médias empresas que precisam organizar sua operação comercial, estoque, produção, pedidos, orçamentos e informações fiscais.  
**Canais de acesso:** Aplicação web e aplicativo para dispositivos móveis.

O GestorIA é uma plataforma de gestão empresarial com uma experiência orientada por Inteligência Artificial. A proposta é transformar informações que normalmente ficam dispersas em WhatsApp, cadernos e planilhas em dados estruturados, permitindo que o gestor acompanhe clientes, produtos, estoque, pedidos, orçamentos, produção, documentos fiscais e indicadores em um único ambiente.

O sistema será disponibilizado por dois canais complementares: **web**, para utilização em computadores e navegadores, e **aplicativo móvel**, para permitir que o usuário acompanhe a operação e execute tarefas compatíveis com dispositivos móveis sem depender exclusivamente do acesso pelo navegador.

O Lean Canvas do projeto define como público-alvo donos e gestores de pequenas e médias empresas, citando como exemplos padarias, confeitarias, oficinas, salões e assistências. A proposta de valor está relacionada à simplificação da operação, ao radar operacional e ao apoio da IA com confirmação humana. O modelo de receita previsto para a evolução do projeto é a assinatura mensal por empresa, com possibilidade de planos por usuários ou volume de pedidos e add-ons para recursos como Copiloto IA e integração fiscal.

---

# 2. Problema e oportunidade

Pequenas e médias empresas frequentemente utilizam diferentes ferramentas para registrar clientes, produtos, pedidos, estoque e informações administrativas. Quando esses dados não estão estruturados em um único sistema, o gestor tem maior dificuldade para acompanhar a operação e identificar prioridades.

Além da fragmentação das informações, depender exclusivamente de um computador ou navegador pode dificultar o acompanhamento da operação em situações nas quais o gestor ou funcionário está fora do ambiente de trabalho.

O GestorIA procura atender esse cenário reunindo em uma única plataforma:

- Cadastro de clientes;
- Cadastro de produtos;
- Controle de estoque;
- Pedidos;
- Orçamentos;
- Produção;
- Documentos fiscais;
- Relatórios;
- Indicadores operacionais;
- Copiloto com Inteligência Artificial;
- Acesso web;
- Acesso por aplicativo móvel.

A oportunidade está em oferecer uma solução com menor complexidade operacional para empresas que não precisam, em um primeiro momento, de uma estrutura extensa de ERP tradicional, mas que precisam consultar e registrar informações de forma prática em diferentes dispositivos.

---

# 3. Público-alvo

O público-alvo principal é formado por **donos e gestores de pequenas e médias empresas**, especialmente negócios nos quais o acompanhamento da operação depende de informações comerciais e de estoque.

Entre os segmentos identificados no Lean Canvas estão:

- Padarias;
- Confeitarias;
- Oficinas;
- Salões;
- Assistências;
- Outros pequenos negócios com operação de vendas, estoque, pedidos ou produção.

O sistema também pode atender empresas de comércio e serviços que necessitem centralizar clientes, produtos, pedidos, orçamentos, documentos fiscais e indicadores.

O aplicativo móvel será especialmente útil para usuários que precisam consultar informações, acompanhar pedidos, verificar indicadores ou realizar operações compatíveis com dispositivos móveis durante a rotina da empresa.

---

# 4. Proposta de valor

A proposta do GestorIA é transformar a operação diária da empresa em informação estruturada e útil para gestão, disponibilizando essa informação tanto no computador quanto em dispositivos móveis.

Os principais elementos da proposta são:

1. **Centralização:** clientes, produtos, estoque, pedidos, orçamentos e informações fiscais em uma única plataforma.
2. **Acesso multiplataforma:** utilização por navegador e aplicativo móvel, utilizando a mesma base de dados e regras de negócio.
3. **Mobilidade:** permitir que o usuário acompanhe a empresa mesmo quando não estiver diante de um computador.
4. **Simplicidade:** reduzir a necessidade de controles paralelos em planilhas, cadernos e mensagens.
5. **Radar operacional:** destacar informações que exigem atenção do gestor.
6. **Modo Fábrica:** permitir acompanhamento de pedidos em produção.
7. **Relatórios:** transformar os dados operacionais em indicadores e visualizações.
8. **Inteligência Artificial:** auxiliar na interpretação das informações, mantendo a decisão sob responsabilidade do usuário.
9. **Segurança:** isolamento dos dados de cada empresa e controles de autenticação e autorização.
10. **Integração fiscal:** estruturar documentos fiscais, eventos, fornecedores e vínculos com pedidos e estoque.

---

# 5. Modelo de negócio

O GestorIA será estruturado como um **SaaS**, ou seja, o cliente utiliza a plataforma mediante uma assinatura recorrente.

Esse modelo é adequado ao projeto porque o produto não é vendido como uma instalação única. O cliente paga para utilizar continuamente a plataforma e receber manutenção, evolução e novos recursos.

A assinatura dará acesso ao ecossistema GestorIA, incluindo os canais web e móvel conforme os recursos disponíveis em cada plano. O aplicativo não será tratado como um produto separado, evitando a criação de duas bases comerciais para o mesmo serviço.

A receita principal será:

- Assinatura mensal;
- Assinatura anual;
- Planos diferenciados por funcionalidades e quantidade de usuários;
- Recursos adicionais contratados separadamente.

O Lean Canvas prevê como evolução do projeto planos por usuários ou volume de pedidos e add-ons como Copiloto IA e integração fiscal.

---

# 6. Plano de Negócios — Cenário Lean

## 6.1 Objetivo

O cenário Lean representa a estrutura mínima necessária para colocar o GestorIA em operação comercial, disponibilizando uma versão web e uma versão móvel funcional sem assumir uma estrutura empresarial maior do que a necessária para validar o produto.

A prioridade é manter os gastos controlados enquanto a empresa valida:

- Interesse dos clientes;
- Utilização real da plataforma;
- Utilização do aplicativo;
- Retenção;
- Receita recorrente;
- Custo de aquisição;
- Necessidades de suporte;
- Necessidade de novos recursos;
- Quais funcionalidades são mais utilizadas em cada canal.

## 6.2 Estrutura operacional

| Recurso | Cenário Lean |
| :--- | :--- |
| Desenvolvimento | Equipe técnica pequena, acumulando funções |
| Web | Aplicação web para utilização em computadores e navegadores |
| Aplicativo | Aplicativo móvel multiplataforma com funcionalidades prioritárias |
| Backend | API central compartilhada entre web e aplicativo |
| Infraestrutura | Cloud enxuta com PostgreSQL e backups |
| Frontend Web | Tecnologia já utilizada no projeto |
| Backend | FastAPI e Python |
| Banco de dados | PostgreSQL |
| Deploy | Docker |
| Monitoramento | Ferramentas gratuitas ou de baixo custo |
| Atendimento | Suporte digital |
| Marketing | Conteúdo, indicação e demonstrações |
| Contabilidade | Serviço terceirizado |
| Inteligência Artificial | Uso controlado conforme necessidade e custo |
| Fiscal | Estrutura preparada para integração, com validação profissional quando necessária |
| Distribuição móvel | Publicação nas lojas de aplicativos conforme disponibilidade do produto |

## 6.3 Investimento inicial estimado

Os valores abaixo são uma **estimativa acadêmica para planejamento**, e não representam cotações comerciais definitivas.

| Item | Investimento estimado |
| :--- | ---: |
| Domínio e identidade digital inicial | R$ 300 |
| Configuração inicial de infraestrutura | R$ 500 |
| Ferramentas e serviços de desenvolvimento | R$ 500 |
| Configuração e preparação do aplicativo móvel | R$ 1.000 |
| Materiais comerciais e demonstração | R$ 300 |
| Reserva para serviços externos e distribuição móvel | R$ 600 |
| **Total estimado** | **R$ 3.200** |

O investimento inicial aumenta em relação a uma operação exclusivamente web porque passa a contemplar a preparação, testes e distribuição do aplicativo móvel.

## 6.4 Custos e despesas mensais estimados

| Categoria | Classificação | Estimativa mensal |
| :--- | :--- | ---: |
| Servidor/cloud | Custo do serviço | R$ 250 |
| Banco de dados e armazenamento | Custo do serviço | R$ 100 |
| E-mail, domínio e serviços auxiliares | Custo/Despesa | R$ 50 |
| Monitoramento e backups | Custo do serviço | R$ 50 |
| Serviços relacionados ao aplicativo | Custo do serviço | R$ 50 |
| Contabilidade | Despesa administrativa | R$ 300 |
| Marketing inicial | Despesa de marketing e vendas | R$ 300 |
| Taxas de pagamento | Despesa financeira | R$ 100 |
| Ferramentas administrativas | Despesa administrativa | R$ 100 |
| Reserva para APIs de IA | Custo do serviço | R$ 150 |
| **Subtotal sem equipe** | | **R$ 1.450** |

A equipe é o principal componente de custo de um negócio de software. Para o cenário acadêmico, não é adequado considerar o trabalho dos integrantes como custo zero em uma operação comercial definitiva. Portanto, a remuneração da equipe deve ser adicionada quando houver operação empresarial real.

---

# 7. Plano de Negócios — Cenário Ideal

## 7.1 Objetivo

O cenário ideal representa uma estrutura preparada para crescimento, atendimento de clientes e evolução contínua do produto, considerando a existência de web e aplicativo móvel.

Nesse cenário, o GestorIA possui recursos suficientes para separar desenvolvimento web, desenvolvimento mobile, suporte, vendas, marketing e administração.

## 7.2 Estrutura operacional

| Recurso | Cenário Ideal |
| :--- | :--- |
| Desenvolvimento | Equipe dedicada de desenvolvimento |
| Desenvolvimento mobile | Responsável ou equipe dedicada ao aplicativo |
| Produto | Responsável por produto e experiência do usuário |
| Infraestrutura | Cloud escalável com redundância e monitoramento |
| Banco de dados | PostgreSQL com backups automatizados e estratégia de recuperação |
| Segurança | Monitoramento, gestão de acessos e auditoria |
| Atendimento | Suporte estruturado para web e mobile |
| Comercial | Processo de aquisição e acompanhamento de clientes |
| Marketing | Conteúdo, anúncios, demonstrações e relacionamento |
| Fiscal/contábil | Assessoria especializada |
| IA | APIs de IA com controle de custos e limites de uso |
| Dados | Indicadores de produto, clientes e operação |
| Qualidade | Testes web, mobile, API e compatibilidade entre versões |
| Distribuição | Gestão das lojas de aplicativos e atualizações |

## 7.3 Investimento inicial estimado

| Item | Investimento estimado |
| :--- | ---: |
| Infraestrutura e configuração de produção | R$ 3.000 |
| Identidade visual, materiais e site comercial | R$ 2.000 |
| Desenvolvimento e preparação inicial do aplicativo | R$ 4.000 |
| Equipamentos e ferramentas de trabalho | R$ 5.000 |
| Segurança, backups e monitoramento inicial | R$ 2.000 |
| Marketing de lançamento | R$ 3.000 |
| Consultoria contábil/fiscal e jurídica inicial | R$ 2.000 |
| Reserva operacional e distribuição mobile | R$ 2.000 |
| **Total estimado** | **R$ 23.000** |

## 7.4 Custos e despesas mensais estimados

| Categoria | Classificação | Estimativa mensal |
| :--- | :--- | ---: |
| Infraestrutura cloud | Custo do serviço | R$ 1.000 |
| Banco, armazenamento e backups | Custo do serviço | R$ 500 |
| APIs e serviços de terceiros | Custo do serviço | R$ 700 |
| Serviços e monitoramento mobile | Custo do serviço | R$ 400 |
| Segurança e monitoramento | Custo do serviço | R$ 300 |
| Desenvolvimento e produto | Custo do serviço | R$ 12.000 |
| Suporte | Despesa operacional | R$ 3.000 |
| Contabilidade e serviços administrativos | Despesa administrativa | R$ 1.000 |
| Marketing e publicidade | Despesa de marketing e vendas | R$ 3.000 |
| Vendas e comissões | Despesa de marketing e vendas | R$ 2.000 |
| Ferramentas administrativas/CRM | Despesa administrativa | R$ 700 |
| Taxas financeiras e meios de pagamento | Despesa financeira | R$ 500 |
| **Total estimado** | | **R$ 25.100** |

Os valores apresentados são estimativas para o planejamento inicial e devem ser ajustados conforme as necessidades reais da operação.

---

# 8. Classificação dos gastos

A classificação dos gastos será utilizada para organizar os custos e despesas do GestorIA de acordo com sua relação com a operação.

**Custo** é o gasto necessário para disponibilizar o produto ou serviço. No caso de uma empresa de tecnologia, entram nessa categoria principalmente desenvolvimento diretamente relacionado ao produto, infraestrutura da aplicação, aplicativo móvel e serviços de terceiros utilizados para disponibilizar o serviço.

**Despesa** está relacionada à administração, vendas, marketing, suporte e demais atividades necessárias para manter e comercializar o negócio.

## 8.1 Custos do GestorIA

- Desenvolvimento diretamente relacionado ao produto;
- Desenvolvimento e manutenção do aplicativo;
- Servidores;
- PostgreSQL;
- Armazenamento;
- Backups da aplicação;
- Serviços de infraestrutura;
- APIs de terceiros utilizadas diretamente na entrega do serviço;
- Serviços de distribuição e suporte ao aplicativo;
- Serviços diretamente relacionados à evolução da plataforma.

## 8.2 Despesas administrativas

- Contabilidade;
- Serviços jurídicos;
- Ferramentas administrativas;
- Aluguel, caso exista escritório;
- Equipamentos administrativos;
- Treinamentos;
- Serviços bancários.

## 8.3 Despesas de marketing e vendas

- Publicidade;
- Anúncios pagos;
- CRM;
- Comissões;
- Eventos;
- Materiais promocionais;
- Viagens comerciais;
- Ferramentas de prospecção.

## 8.4 Despesas financeiras

- Tarifas bancárias;
- Taxas de cartão;
- Taxas de boleto;
- Tarifas de gateways;
- Juros de financiamentos, quando existentes.

---

# 9. Estratégia Multiplataforma

O GestorIA terá a aplicação web e o aplicativo móvel como canais complementares.

A arquitetura deve manter o **backend e o banco de dados como núcleo central do sistema**, permitindo que diferentes clientes de aplicação utilizem as mesmas regras de negócio.

### Web

O acesso web será direcionado principalmente para:

- Cadastros extensos;
- Administração;
- Configurações;
- Relatórios;
- Fiscal;
- Gestão de usuários;
- Operações que exigem telas maiores.

### Aplicativo móvel

O aplicativo será direcionado principalmente para:

- Consulta rápida de clientes;
- Consulta de produtos;
- Consulta e acompanhamento de pedidos;
- Atualização de informações compatíveis com dispositivos móveis;
- Acompanhamento da produção;
- Indicadores resumidos;
- Notificações;
- Acesso rápido ao radar operacional;
- Recursos do Copiloto compatíveis com o dispositivo.

Nem todas as funcionalidades precisam estar disponíveis no aplicativo desde a primeira versão. A estratégia Lean é priorizar as funções de maior utilização móvel e ampliar a cobertura conforme a necessidade dos usuários.

### Sincronização

O aplicativo e a aplicação web devem utilizar a mesma API e as mesmas regras de negócio sempre que possível.

A sincronização deve considerar:

- Autenticação;
- Organização/empresa do usuário;
- Permissões;
- Clientes;
- Produtos;
- Pedidos;
- Orçamentos;
- Estoque;
- Indicadores;
- Documentos fiscais;
- Histórico das operações.

Dessa forma, uma alteração realizada em um canal poderá ser refletida nos demais conforme as regras de sincronização definidas pelo sistema.

### Segurança

O aplicativo não deve possuir uma base de dados empresarial independente. As informações devem permanecer centralizadas no backend, respeitando o isolamento por empresa e as regras de autorização.

O armazenamento local no dispositivo deve ser limitado às informações necessárias para o funcionamento do aplicativo e deve evitar a exposição desnecessária de dados empresariais.

---
ading Plano de Negocios GestorIA.md…]()


