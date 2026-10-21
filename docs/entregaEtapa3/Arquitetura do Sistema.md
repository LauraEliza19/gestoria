# Arquitetura do Sistema — GestorIA

## 1. Visão geral

O GestorIA adota uma arquitetura cliente-servidor modular. A aplicação web e o aplicativo mobile compartilham a mesma API REST, que centraliza autenticação, autorização, regras de negócio, auditoria e acesso ao banco de dados.

```text
┌──────────────────────┐       ┌────────────────────────┐
│ Web — React e Vite   │       │ Mobile — Expo/React   │
│ Operação completa    │       │ Gestão à distância    │
└──────────┬───────────┘       └───────────┬────────────┘
           │ HTTPS / JSON                   │ HTTPS / JSON
           └──────────────┬─────────────────┘
                          ▼
              ┌───────────────────────┐
              │ API REST — FastAPI    │
              │ Segurança e contratos │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │ Camada de serviços    │
              │ Regras e transações   │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │ Repositórios / ORM    │
              │ SQLAlchemy 2          │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │ PostgreSQL 17         │
              │ Dados por organização │
              └───────────────────────┘
```

## 2. Objetivos arquiteturais

- manter regras de negócio fora das interfaces;
- permitir que web e mobile reutilizem os mesmos contratos;
- isolar os dados de cada empresa;
- controlar permissões no backend;
- registrar operações sensíveis;
- suportar evolução por módulos;
- possibilitar testes em cada camada;
- preparar implantação segura em contêineres.

## 3. Camadas

### 3.1 Clientes

#### Aplicação web

Desenvolvida com React, TypeScript, Vite e Tailwind CSS. Usa roteamento no cliente e um layout protegido por sessão. É voltada a cadastros, operação detalhada, consulta e administração.

Principais responsabilidades:

- renderizar páginas e formulários;
- validar entradas para melhorar a experiência;
- consultar a API;
- apresentar permissões e estados de operação;
- manter apenas estado de interface, sem substituir a validação do servidor.

#### Aplicativo mobile

Desenvolvido com React Native, Expo, Expo Router e TypeScript. Usa a mesma API da aplicação web e prioriza visão executiva, alertas, consulta e decisões rápidas.

Principais responsabilidades:

- autenticar o usuário;
- mostrar indicadores e prioridades;
- navegar entre módulos;
- adaptar a experiência a telas móveis;
- tratar indisponibilidade e renovação de sessão.

### 3.2 API

A API FastAPI expõe contratos HTTP sob o prefixo `/api`. Seus roteadores são separados por domínio:

- autenticação;
- painel executivo;
- clientes;
- produtos;
- pedidos e operações de pedido;
- orçamentos;
- produção;
- fiscal e fornecedores;
- financeiro;
- organização;
- gestão interna;
- vínculos e ocorrências de funcionários;
- Copiloto.

Os schemas Pydantic definem os dados de entrada e saída. As rotas fazem a composição entre autenticação, permissão, serviço e resposta HTTP.

### 3.3 Serviços

A camada de serviços executa regras de negócio e coordena transações. Exemplos:

- criação e renovação de sessão;
- mudança de estado de pedidos;
- reserva e consumo de estoque;
- cálculo de disponibilidade por receita;
- atualização de documentos fiscais;
- gestão de vínculos e ocorrências;
- reconhecimento de intenções e execução controlada de ferramentas do Copiloto.

Essa camada evita que regras críticas fiquem duplicadas entre web e mobile.

### 3.4 Repositórios

Os repositórios concentram consultas e operações de persistência. Eles recebem o contexto da organização e usam SQLAlchemy para acessar os modelos.

Benefícios:

- consultas reutilizáveis;
- testes mais objetivos;
- separação entre regra e persistência;
- aplicação consistente do isolamento por empresa.

### 3.5 Banco de dados

O banco principal é PostgreSQL 17. O projeto usa SQLAlchemy 2 como ORM e Alembic para migrations versionadas.

Domínios persistidos incluem:

- organizações, usuários, membros e sessões;
- clientes;
- produtos e estoque;
- pedidos, itens, operações e auditoria;
- orçamentos e itens;
- produção, receitas e ingredientes;
- documentos, itens e eventos fiscais;
- fornecedores;
- categorias e lançamentos financeiros;
- funcionários, vínculos, centros de custo e ocorrências.

Valores monetários e quantidades usam tipos numéricos apropriados no banco, evitando cálculos financeiros com ponto flutuante binário.

## 4. Organização do repositório

```text
gestoria-limpo/
├── backend/
│   ├── alembic/             # migrations
│   ├── app/
│   │   ├── api/             # endpoints e dependências HTTP
│   │   ├── models/          # entidades SQLAlchemy
│   │   ├── repositories/    # acesso a dados
│   │   ├── schemas/         # contratos Pydantic
│   │   └── services/        # regras de negócio
│   └── tests/               # testes automatizados
├── frontend/
│   ├── src/app/             # roteamento
│   ├── src/components/      # componentes compartilhados
│   ├── src/contexts/        # sessão e estado transversal
│   ├── src/layouts/         # estrutura das páginas
│   ├── src/pages/           # módulos web
│   ├── src/services/        # cliente da API
│   └── tests/               # testes da interface
├── mobile/
│   ├── src/app/             # rotas Expo Router
│   ├── src/components/      # componentes compartilhados
│   ├── src/features/        # funcionalidades por domínio
│   ├── src/services/        # cliente da API
│   ├── src/theme/           # tokens visuais
│   └── tests/               # testes da interface mobile
├── deploy/                  # configuração do proxy
├── docs/                    # documentação técnica e funcional
└── docker-compose*.yml      # ambientes de execução
```

## 5. Autenticação e autorização

### 5.1 Sessões

O backend cria sessões persistidas e envia o identificador em cookie `HttpOnly`. O token não é armazenado em texto puro no banco; sua representação protegida é usada para localizar a sessão.

O fluxo contempla:

- login com limite de tentativas por IP e por conta;
- duração de acesso e duração total da sessão;
- renovação com rotação do token;
- logout da sessão atual;
- revogação de todas as sessões do usuário;
- cookie seguro no ambiente de produção.

Web e mobile enviam credenciais de sessão nas requisições e tentam renovar a sessão quando o acesso expira.

### 5.2 Permissões

O vínculo entre usuário e organização possui papéis `owner`, `admin` e `member`. A interface pode ocultar ou bloquear opções para melhorar a experiência, mas a autorização definitiva acontece no backend.

Exemplos de permissões específicas:

- leitura da gestão interna;
- manutenção de funcionários;
- manutenção de centros de custo;
- operações de pedidos e produção;
- consulta e alteração de dados fiscais.

## 6. Multiempresa

Cada sessão está associada a uma organização. Entidades de negócio usam `organization_id`, e as consultas devem sempre ser filtradas pela empresa autenticada.

Regras arquiteturais:

1. o cliente não escolhe livremente a organização de uma consulta protegida;
2. o backend obtém a organização a partir da sessão;
3. repositórios recebem esse contexto;
4. relacionamentos críticos possuem restrições que incluem a organização;
5. testes de autorização verificam tentativas de acesso cruzado.

## 7. Integridade, concorrência e auditoria

Operações de estoque, produção, sessão e pedidos podem receber requisições simultâneas. Para evitar duplicidade ou saldo incorreto, o projeto usa transações, restrições no banco, chaves de idempotência e controle de concorrência conforme o fluxo.

Operações críticas podem gerar registros de auditoria contendo, conforme o caso:

- usuário responsável;
- organização;
- operação executada;
- data e hora;
- pedido ou entidade relacionada;
- resultado da operação.

## 8. Copiloto

O Copiloto não recebe acesso direto ao banco. O fluxo atual é:

```text
Mensagem → reconhecimento de intenção → ferramenta permitida
         → serviço/repositório com organização autenticada
         → resposta estruturada com fonte e ações sugeridas
```

A versão atual trabalha com intenções e respostas controladas. A integração futura com um provedor de IA deve ficar atrás de uma abstração no backend, com segredo fora do cliente, limite de uso, auditoria e validação das ferramentas permitidas.

## 9. Execução e implantação

### 9.1 Desenvolvimento

O Docker Compose de desenvolvimento inicia:

- PostgreSQL;
- API FastAPI com recarga automática;
- aplicação de migrations na inicialização.

O frontend Vite e o Expo podem ser executados separadamente durante o desenvolvimento. O mobile recebe a URL da API por variável pública de ambiente, necessária para acesso a partir de um dispositivo na rede local.

### 9.2 Produção

O ambiente de produção usa:

- PostgreSQL em rede interna;
- FastAPI com múltiplos workers;
- Caddy como proxy HTTPS;
- hosts e origens permitidos explicitamente;
- cookies seguros;
- documentação OpenAPI desabilitada publicamente;
- proteção `no-new-privileges` no contêiner da API.

A API serve o build estático da aplicação React e devolve o arquivo principal para rotas da aplicação. O Caddy é o ponto público e encaminha as requisições para a API.

## 10. Qualidade

### Backend

- Pytest para testes unitários e de integração;
- Ruff para lint e formatação;
- testes de autorização, isolamento, concorrência, sessão e regras de negócio.

### Web

- TypeScript;
- Oxlint;
- Prettier;
- Node Test Runner;
- build de produção pelo Vite.

### Mobile

- TypeScript;
- ESLint com configuração Expo;
- Node Test Runner;
- validação no Expo Web e em dispositivo.

## 11. Estado dos módulos

| Domínio | Backend | Web | Mobile |
|---|---|---|---|
| Autenticação | Funcional | Funcional | Funcional |
| Painel executivo | Funcional | Funcional | Funcional |
| Clientes | Funcional | Funcional | Em integração |
| Produtos e estoque | Funcional | Funcional | Em integração |
| Pedidos | Funcional | Funcional | Funcional |
| Orçamentos | Funcional | Funcional | Em integração |
| Produção | Funcional | Funcional | Em integração |
| Fiscal | Funcional no escopo interno | Funcional | Em integração |
| Gestão interna | Funcional | Funcional | Em integração |
| Copiloto controlado | Funcional | Funcional | Funcional |
| Financeiro | Funcional | Funcional | Planejado |

## 12. Restrições e evolução

- o Copiloto ainda não usa um provedor externo de IA;
- emissão fiscal por provedor externo não está consolidada;
- módulos mobile além de Pedidos ainda precisam de telas operacionais completas;
- o financeiro foi integrado à arquitetura estável, mas ainda precisa de uma jornada mobile;
- observabilidade, backup automatizado e entrega contínua devem ser formalizados antes da operação comercial.

## 13. Decisões registradas

| Decisão | Justificativa |
|---|---|
| API única para web e mobile | evita duplicação de regras e contratos |
| Backend em camadas | separa HTTP, negócio e persistência |
| PostgreSQL | oferece integridade relacional e suporte transacional |
| `organization_id` nos domínios | garante arquitetura multiempresa |
| Sessão em cookie `HttpOnly` | reduz exposição do identificador ao JavaScript |
| Alembic | mantém evolução reproduzível do banco |
| Ferramentas controladas no Copiloto | impede acesso livre do modelo aos dados |
| Docker Compose | padroniza desenvolvimento e implantação |

## 14. Evidências

- composição dos módulos da API: `backend/app/main.py`;
- configuração de segurança: `backend/app/http_security.py` e `backend/app/config.py`;
- sessões: `backend/app/services/sessions.py`;
- modelos: `backend/app/models/`;
- migrations: `backend/alembic/versions/`;
- roteamento web: `frontend/src/app/router.tsx`;
- roteamento mobile: `mobile/src/app/`;
- desenvolvimento: `docker-compose.yml`;
- produção: `docker-compose.production.yml` e `deploy/Caddyfile`.
