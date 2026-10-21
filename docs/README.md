<div align="center">

# Documentação GestorIA

### Produto, arquitetura, segurança e evolução em um só lugar.

<img alt="Produto" src="https://img.shields.io/badge/produto-GestorIA-2867E8?style=flat-square" />
<img alt="Arquitetura" src="https://img.shields.io/badge/arquitetura-web%20%2B%20mobile%20%2B%20API-071225?style=flat-square" />
<img alt="Documentação" src="https://img.shields.io/badge/documentação-viva-17AEE6?style=flat-square" />

</div>

---

## Comece por aqui

| Documento | Quando consultar |
| :--- | :--- |
| [Projeto de Interface](<entregaEtapa3/Projeto de Interface.md>) | entender navegação, experiência e identidade visual |
| [Arquitetura do Sistema](<entregaEtapa3/Arquitetura do Sistema.md>) | compreender camadas, segurança, banco e implantação |
| [Especificação do projeto](<../Especificação do Projeto.md>) | consultar visão funcional e requisitos gerais |
| [Contexto do produto](<../Documento de Contexto.md>) | conhecer problema, público e decisões iniciais |
| [README principal](../README.md) | executar o projeto e visualizar seu estado atual |

### Guias por aplicação

| Aplicação | Documento |
| :--- | :--- |
| Backend | [API, rotas, segurança e testes](../backend/README.md) |
| Web | [módulos, rotas e execução React](../frontend/README.md) |
| Mobile | [Expo, configuração da API e identidade Sereno](../mobile/README.md) |

---

## Produto e estratégia

| Tema | Documento |
| :--- | :--- |
| Plano de negócios | [Plano de Negócios GestorIA](<../Documentação de Contexto/Plano de Negocios GestorIA.md>) |
| Tributos e precificação | [Tributos e Precificação](<../Documentação de Contexto/Tributos e Precificacao GestorIA.md>) |
| Personas | [Personas](<pdf/Personas GestorIA.pdf>) |
| Mapa de empatia | [Mapa de empatia](<pdf/Mapa de empatia.pdf>) |
| Lean Canvas | [Lean Canvas](pdf/lean-canvas.pdf) |
| Missão, visão e valores | [Missão, visão e valores](pdf/missao-visao-valores.pdf) |
| Análise estratégica | [Matriz SWOT](<entregaEtapa3/Análise de Ambientes (SWOT).md>) |

---

## Arquitetura e segurança

| Documento | Escopo |
| :--- | :--- |
| [Arquitetura do Sistema](<entregaEtapa3/Arquitetura do Sistema.md>) | visão consolidada de web, mobile, backend e dados |
| [Sessões seguras](SEGURANCA-SESSOES.md) | login, cookies, renovação e produção |
| [Segurança de pedidos](SEGURANCA_PEDIDOS.md) | HMAC, confirmação, idempotência e auditoria |
| [Validação de segurança](VALIDACAO-SEGURANCA.md) | verificações e resultados de segurança |

### Regras fundamentais

- dados de negócio sempre isolados por organização;
- autorização validada no backend;
- ações críticas com confirmação e auditoria;
- migrations versionadas e nunca reescritas depois de aplicadas;
- segredos mantidos fora das aplicações cliente;
- web e mobile compartilham os mesmos contratos da API.

---

## Módulos

| Módulo | Documento | Estado documental |
| :--- | :--- | :---: |
| Copiloto | [MVP controlado](COPILOTO-MVP.md) | `atual` |
| Gestão interna | [Limites e arquitetura](GESTAO-INTERNA.md) | `atual` |
| Funcionários | [Advertências e ocorrências](ADVERTENCIAS-OCORRENCIAS.md) | `atual` |
| Produção | [Produção e cozinha](PRODUCAO_COZINHA.md) | `atual` |
| Fiscal | [Atualizações e testes](FISCAL_ATUALIZACOES_E_TESTES.md) | `atual` |
| Pedidos | [Segurança de pedidos](SEGURANCA_PEDIDOS.md) | `atual` |
| Financeiro | [Categorias, lançamentos e saldo](FINANCEIRO.md) | `atual` |

---

## Entrega acadêmica — Etapa 3

- [Template da entrega](entregaEtapa3/Template.md)
- [Projeto de Interface](<entregaEtapa3/Projeto de Interface.md>)
- [Arquitetura do Sistema](<entregaEtapa3/Arquitetura do Sistema.md>)
- [Análise de Ambientes — SWOT](<entregaEtapa3/Análise de Ambientes (SWOT).md>)
- [Contribuições individuais](<entregaEtapa3/Contribuições individuais na implementação do projeto.md>)

As planilhas de Balanced Scorecard e Fluxo de Caixa serão adicionadas após confirmação do formato solicitado pelo professor.

---

## Registros históricos

Os documentos abaixo preservam decisões e resultados de fases anteriores. Eles
ajudam a explicar a evolução do projeto, mas não substituem a especificação, a
arquitetura ou os READMEs atuais:

- [Protótipo frontend original](<../Documentação de Contexto/README-frontend (Lucas - 26-08).md>);
- [Primeira integração de pedidos e clientes](<../Documentação de Contexto/README-pedidos-clientes(Lucas -26-08).md>);
- [Tese inicial do produto](<../Documentação de Contexto/README-produto.md>);
- [Entrega de segurança de pedidos de 08/09/2026](SEGURANCA_PEDIDOS.md);
- [Validação de segurança](VALIDACAO-SEGURANCA.md);
- relatórios JSON/XML de validações executadas em datas específicas.

Afirmações sobre stack, quantidade de testes, pendências e caminhos de arquivos
nesses registros devem ser interpretadas conforme a data informada no próprio
artefato.

---

## Evidências de validação

Os relatórios abaixo são artefatos técnicos históricos gerados por verificações
do projeto. Eles não representam automaticamente o resultado da suíte atual:

- `validation-results.json` e `validation-junit.xml`;
- `fiscal-validation-results.json` e `fiscal-validation-junit.xml`;
- `fiscal-migration-smoke-results.json`;
- `benchmark-results.json`.

Os testes executáveis permanecem próximos ao código:

```text
backend/tests/     regras, APIs, autorização e concorrência
frontend/tests/    contratos e fluxos da interface web
mobile/tests/      contratos e identidade da interface mobile
```

---

## Manutenção da documentação

Ao alterar comportamento, arquitetura ou segurança:

1. atualize o documento responsável pelo assunto;
2. informe a mudança no Pull Request;
3. diferencie claramente o que está funcional, simulado ou planejado;
4. mantenha exemplos e comandos compatíveis com o código atual;
5. evite duplicar regras técnicas em vários arquivos;
6. adicione evidências de teste quando a mudança for sensível.

---

<div align="center">

<strong>Documentação viva é parte do produto.</strong><br />
<sub>GestorIA · clareza para construir, operar e decidir.</sub>

</div>
