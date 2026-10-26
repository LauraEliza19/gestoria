# Template de Entrega do Projeto — GestorIA

> **Observação:** este arquivo é um modelo provisório de consolidação da entrega. O título “Template.md” é ambíguo sem o modelo fornecido pelo professor. A estrutura abaixo pode ser usada imediatamente e ajustada quando o formato oficial for confirmado.

## 1. Identificação

- **Instituição:** [preencher]
- **Curso:** [preencher]
- **Disciplina:** [preencher]
- **Professor/mentor:** [preencher]
- **Projeto:** GestorIA
- **Turma/período:** [preencher]
- **Data da entrega:** [preencher]

## 2. Integrantes

- Lucas Paschoalini
- Laura Eliza Palagano
- Danilo Andrade
- Gabriel
- Otávio
- Leonardo
- Kaio
- Adryan Henrique

> Conferir os nomes completos e a grafia antes da entrega final.

## 3. Resumo do projeto

O GestorIA é uma plataforma de gestão empresarial com aplicações web e mobile. O sistema reúne dados de clientes, produtos, pedidos, orçamentos, produção, estoque, documentos fiscais, gestão interna e indicadores executivos. Seu objetivo é oferecer ao gestor uma visão integrada da empresa e apoiar decisões com informações rastreáveis, permissões e confirmação para ações sensíveis.

## 4. Problema

Pequenas e médias empresas frequentemente distribuem dados comerciais, operacionais e administrativos entre planilhas, mensagens e ferramentas isoladas. Isso dificulta o acompanhamento, aumenta retrabalho e reduz a velocidade das decisões.

## 5. Solução proposta

Uma plataforma única que:

- ERP completo.
- organiza os principais módulos da empresa;
- oferece visão executiva no computador e no celular;
- centraliza prioridades e alertas;
- mantém isolamento dos dados por empresa;
- registra operações sensíveis;
- disponibiliza um Copiloto controlado para consultas e navegação assistida.

## 6. Público-alvo

- proprietários e administradores de pequenas e médias empresas;
- gestores que precisam acompanhar a operação à distância;
- equipes comerciais, produtivas, fiscais e administrativas autorizadas.

## 7. Escopo implementado

### Web

- autenticação e sessão;
- painel;
- clientes;
- produtos e estoque;
- pedidos;
- orçamentos;
- produção;
- fiscal;
- financeiro;
- gestão interna;
- dados da empresa;
- Copiloto controlado.

### Mobile

- autenticação;
- início executivo;
- central de alertas;
- Copiloto;
- pedidos;
- catálogo de módulos;
- conta do usuário.

### Backend

- API REST em camadas;
- persistência PostgreSQL;
- migrations;
- permissões e isolamento por organização;
- sessões seguras;
- auditoria de operações críticas;
- testes automatizados.

## 8. Tecnologias

| Camada | Tecnologias principais |
|---|---|
| Web | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Mobile | React Native, Expo, Expo Router, TypeScript |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic |
| Banco de dados | PostgreSQL 17 |
| Migrations | Alembic |
| Infraestrutura | Docker, Docker Compose e Caddy |
| Qualidade | Pytest, Node Test Runner, ESLint/Oxlint, TypeScript e Prettier |

## 9. Documentos desta entrega

- [Projeto de Interface](<./Projeto de Interface.md>)
- [Arquitetura do Sistema](<./Arquitetura do Sistema.md>)
- [Análise de Ambientes — SWOT](<./Análise de Ambientes (SWOT).md>)
- [Contribuições individuais](<./Contribuições individuais na implementação do projeto.md>)

As planilhas de Balanced Scorecard e Fluxo de Caixa serão tratadas separadamente após confirmação do professor sobre o formato e a finalidade esperados.

## 10. Evidências de implementação

- código-fonte separado em `frontend/`, `mobile/` e `backend/`;
- migrations em `backend/alembic/`;
- testes em `backend/tests/`, `frontend/tests/` e `mobile/tests/`;
- histórico de commits e pull requests no GitHub;
- documentação técnica e funcional em `docs/`;
- execução local por Docker Compose.

## 11. Demonstração sugerida

1. login;
2. painel executivo;
3. cadastro ou consulta de cliente e produto;
4. criação e acompanhamento de pedido;
5. disponibilidade de produção;
6. consulta fiscal;
7. gestão de funcionário;
8. consulta pelo Copiloto;
9. painel e alertas no aplicativo mobile.

## 12. Limitações atuais

- o Copiloto utiliza respostas e ferramentas controladas; um provedor externo de IA ainda não está integrado;
- parte dos módulos mobile ainda está em integração;
- o módulo financeiro está disponível na web, mas ainda não possui jornada equivalente no mobile;
- integrações externas de emissão fiscal não fazem parte da versão consolidada atual.

## 13. Próximas entregas

- concluir os módulos mobile prioritários;
- validar o financeiro integrado e planejar sua experiência mobile;
- ampliar a cobertura de testes de interface e autorização;
- realizar validação com usuários;
- preparar implantação e monitoramento do ambiente de produção.

## 14. Checklist antes de entregar

- [ ] preencher instituição, curso, disciplina, professor e data;
- [ ] confirmar nomes completos dos integrantes;
- [ ] confirmar com o professor o significado do arquivo `Template.md`;
- [ ] registrar na apresentação que o financeiro foi integrado pelo PR nº 40;
- [ ] inserir capturas das telas utilizadas na apresentação;
- [ ] verificar se todos os links funcionam;
- [ ] anexar ou referenciar as evidências de contribuição;
- [ ] executar os testes do backend, web e mobile.
