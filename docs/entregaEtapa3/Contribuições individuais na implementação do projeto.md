# Contribuições Individuais na Implementação do Projeto — GestorIA

## 1. Objetivo e método

Este documento consolida as contribuições individuais identificadas no histórico do repositório, nas pull requests, no código e na documentação do GestorIA.


## 2. Stack planejada e utilizada

| Área | Tecnologia | Finalidade |
|---|---|---|
| Backend | Python 3.12 e FastAPI | API REST, autenticação e regras de negócio |
| Contratos | Pydantic | validação das entradas e respostas da API |
| Persistência | SQLAlchemy 2 | mapeamento e acesso ao banco |
| Banco de dados | PostgreSQL 17 | armazenamento relacional e transacional |
| Evolução do banco | Alembic | migrations versionadas |
| Frontend web | React 19 e TypeScript | interface web modular |
| Build web | Vite | desenvolvimento e build de produção |
| Estilo web | Tailwind CSS 4 | identidade visual e responsividade |
| Aplicativo | React Native, Expo e Expo Router | interface mobile multiplataforma |
| Infraestrutura | Docker e Docker Compose | ambiente reproduzível |
| Proxy de produção | Caddy | HTTPS e encaminhamento para a API |
| Testes e qualidade | Pytest, Node Test Runner, ESLint/Oxlint, Prettier e TypeScript | prevenção de regressões e padronização |

## 3. Resumo por integrante

### Lucas — arquitetura, gestão interna, Copiloto e mobile

Contribuições identificadas:

- fundação do backend de Gestão Interna;
- funcionários, vínculos, centros de custo e permissões;
- primeira versão funcional das telas de Gestão Interna;
- MVP controlado do Copiloto no backend e web;
- contratos, perguntas mapeadas e testes do Copiloto;
- fundação e navegação do aplicativo mobile;
- listagem de pedidos mobile;
- Copiloto mobile;
- painel executivo e central de alertas mobile;
- identidade visual e padronização das telas mobile.

Evidências representativas no histórico:

- `30e3055` — fundação do backend de Gestão Interna;
- `5fa5b3c` — primeira versão da Gestão Interna;
- `8b9d7f2` — MVP controlado do Copiloto;
- `b55c1bd` — Copiloto no aplicativo mobile;
- `1446c1b` — painel executivo mobile;
- `6d1ad85`, `d1c46f4` e `6f2ad5a` — experiência executiva e identidade visual mobile.

### Laura — documentação do projeto e fundação da interface

Contribuições identificadas:

- especificação do projeto;
- Lean Canvas;
- missão, visão e valores;
- estrutura inicial da interface;
- organização inicial do frontend;
- adoção de Tailwind e testes na fundação da interface;
- contribuições iniciais à estrutura em camadas.

Evidências representativas:

- `7e22da7` — especificação, Lean Canvas e missão/visão/valores;
- `eef6a05` — estrutura frontend e Tailwind;
- `117fc50` — organização em camadas e testes iniciais;
- commits iniciais de estruturação do repositório.

### Danilo — backend, segurança, persistência e operações críticas

Contribuições identificadas:

- PostgreSQL, autenticação e CRUD de produtos;
- persistência de clientes e pedidos;
- sessões seguras e proteções de produção;
- confirmação de operações com HMAC e auditoria;
- vínculos e histórico fiscal;
- testes de segurança, autorização e concorrência.

Evidências representativas:

- `0bff3f5` — PostgreSQL, autenticação e produtos;
- `85c3cab` — persistência de clientes e pedidos;
- `9a261ec` — sessões seguras e proteções de produção;
- `4aea16f` — HMAC, confirmação e auditoria;
- `a7e7c3d` — vínculos e histórico fiscal.

### Gabriel — evolução fiscal e documentação de negócio

Contribuições identificadas:

- consulta de documentos fiscais;
- evolução do domínio fiscal;
- levantamento de necessidades e acompanhamento fiscal;
- elaboração e revisão de conteúdo do plano de negócios.

Evidências representativas:

- `ae75d26` — consulta de notas/documentos fiscais;
- `b62b4eb` e `715c665` — conteúdo do plano de negócios;
- commits associados à evolução fiscal.

### Otávio — interface fiscal e precificação

Contribuições identificadas:

- interface do módulo fiscal;
- estados de processamento, autorização, rejeição e cancelamento;
- detalhes, histórico e navegação fiscal;
- integração da experiência fiscal;
- documentação sobre tributos e precificação.

Evidências representativas:

- `a6ca486` — módulo e integração fiscal;
- `bee953e` — estados, detalhes, histórico e navegação fiscal;
- `983dfe3` — tributos e precificação.

### Leonardo — produção, estoque e modo fábrica

Contribuições identificadas:

- modelagem e evolução do modo fábrica;
- receitas, ingredientes e disponibilidade de produção;
- consumo de estoque durante a produção;
- integração entre pedidos, produção e estoque;
- testes de regras produtivas e transacionais.

Evidências representativas:

- `67b2b7b` — modo fábrica;
- `26fbd3d` — produção, estoque e receitas;
- `4b80671` — consumo de estoque na produção.


### Kaio — painel e fluxo operacional de produção

Contribuições identificadas:

- painel de disponibilidade produtiva;
- consulta dos insumos responsáveis por bloqueios;
- visualização da quantidade possível por receita;
- insumos por pedido e reserva conforme a fila de produção;
- integração da interface com o cálculo real do backend.

Evidências representativas:

- `35ab1f6` — painel de disponibilidade e consulta de insumos;
- `d804ae9` — insumos por pedido e reserva pela fila.

### Adryan — migração da interface e módulo financeiro

Contribuições identificadas:

- migração da interface web para React;
- evolução da estilização com Tailwind;
- implementação do módulo financeiro, posteriormente integrado à branch principal;
- backend, frontend, testes e migration do financeiro;
- correção de exportações e preservação da configuração de CORS.

Evidências representativas:

- `5185290` — migração para React;
- `c535849` — evolução React/Tailwind;
- `556a829` — módulo financeiro;
- `9d60994` — correções de CORS e exportações financeiras.


## 4. Contribuições por camada

| Camada | Participações principais identificadas |
|---|---|
| Pesquisa, negócio e documentação | Laura, Gabriel e Otávio, com contribuições do restante do grupo nos módulos |
| Arquitetura e fundação | Lucas, Laura, Danilo e Adryan |
| Backend e segurança | Danilo e Lucas, com Leonardo e Kaio nos fluxos de produção |
| Interface web | Laura, Adryan, Lucas, Otávio, Leonardo e Kaio conforme os módulos |
| Aplicativo mobile | Lucas |
| Fiscal | Gabriel, Otávio e Danilo |
| Produção e estoque | Leonardo e Kaio |
| Financeiro | Adryan |
| Gestão interna e Copiloto | Lucas, com requisitos de segurança apoiados pela arquitetura existente |

Esta tabela resume a evidência disponível e não substitui a validação do grupo sobre pareamentos e revisões.

## 5. Evidências de que a implementação foi iniciada

O projeto possui implementação executável nas três frentes:

### Backend

- endpoints FastAPI separados por domínio;
- serviços e repositórios;
- modelos SQLAlchemy;
- migrations Alembic;
- testes de API, autorização, segurança e concorrência.

### Frontend web

- páginas React funcionais;
- rotas protegidas;
- formulários e listagens integrados à API;
- testes de interface e build de produção.

### Aplicativo mobile

- autenticação integrada à API;
- painel executivo;
- alertas;
- Copiloto;
- pedidos;
- navegação e identidade visual compartilhadas;
- testes e verificação de tipos.


## 6. Conclusão

O histórico demonstra contribuições distribuídas entre documentação, arquitetura, backend, segurança, interfaces, fiscal, produção, financeiro e mobile. O ponto mais importante para a apresentação é relacionar cada contribuição a uma evidência concreta: tela funcional, endpoint, regra, migration, teste, documento ou pull request.
