<div align="center">

# Política de Segurança

### GestorIA

<img alt="Segurança" src="https://img.shields.io/badge/segurança-divulgação%20responsável-2867E8?style=flat-square" />
<img alt="Dados" src="https://img.shields.io/badge/dados-isolados%20por%20empresa-071225?style=flat-square" />

</div>

---

## Versões acompanhadas

O GestorIA está em desenvolvimento e ainda não possui versões comerciais estáveis.

| Versão | Acompanhamento de segurança |
| :--- | :---: |
| branch `main` | sim |
| branches de funcionalidades abertas | durante a revisão |
| branches antigas ou arquivadas | não |

Correções de segurança devem ser aplicadas primeiro à `main` e, quando necessário, coordenadas com branches ativas.

## Como relatar uma vulnerabilidade

**Não abra uma Issue pública para vulnerabilidades.**

Use um canal privado com os responsáveis pelo repositório. Quando o recurso estiver habilitado, prefira **Security → Report a vulnerability** no GitHub. Caso a opção não apareça, contate um mantenedor diretamente por um canal privado conhecido pela equipe.

Inclua:

- componente afetado;
- descrição objetiva do problema;
- passos mínimos para reprodução;
- impacto possível;
- branch ou commit verificado;
- sugestão de mitigação, se houver;
- evidências sem credenciais nem dados pessoais.

Não envie:

- senhas, cookies, tokens ou chaves reais;
- dados de clientes ou empresas;
- dumps completos de banco;
- exploração destrutiva;
- publicação antecipada do problema.

## Processo de tratamento

A equipe seguirá, conforme a disponibilidade do projeto, este fluxo:

1. confirmar o recebimento pelo canal privado;
2. reproduzir e classificar o impacto;
3. limitar a circulação de detalhes;
4. preparar correção e testes de regressão;
5. revisar autorização, isolamento e auditoria relacionados;
6. integrar a correção;
7. coordenar a divulgação quando aplicável.

Como o projeto ainda é acadêmico, não existe SLA comercial. A meta interna é confirmar o recebimento em até cinco dias úteis e manter o responsável informado sobre a análise.

## Escopo prioritário

Relatos são especialmente relevantes quando envolvem:

- autenticação, cookies ou renovação de sessão;
- quebra de autorização;
- acesso a dados de outra organização;
- exposição de senha, segredo ou token;
- injeção ou validação insuficiente;
- operações financeiras, fiscais ou de estoque incorretas;
- repetição de operações críticas;
- bypass de confirmação ou auditoria;
- configuração insegura de produção;
- ferramentas do Copiloto acessando dados ou ações indevidas.

## Práticas não autorizadas

Sem autorização explícita, não realize:

- indisponibilização intencional do serviço;
- testes contra dados ou contas de terceiros;
- engenharia social;
- envio automatizado em alto volume;
- persistência após demonstrar o problema;
- alteração ou exclusão de dados;
- acesso além do estritamente necessário para comprovação.

## Base de segurança do projeto

O GestorIA adota:

- senhas protegidas com Argon2;
- sessões persistidas, revogáveis e rotacionadas;
- cookies `HttpOnly` e seguros em produção;
- limitação de tentativas de login;
- autorização no backend;
- isolamento multiempresa por `organization_id`;
- transações, idempotência e auditoria;
- migrations versionadas;
- restrição de hosts e origens;
- HTTPS no ambiente de produção;
- testes de segurança, autorização e concorrência.

Documentação relacionada:

- [Sessões seguras](docs/SEGURANCA-SESSOES.md)
- [Segurança de pedidos](docs/SEGURANCA_PEDIDOS.md)
- [Validação de segurança](docs/VALIDACAO-SEGURANCA.md)
- [Arquitetura do Sistema](<docs/entregaEtapa3/Arquitetura do Sistema.md>)

## Segredos e configuração

- nunca faça commit de `.env` ou `.env.local`;
- use chaves diferentes entre desenvolvimento e produção;
- mantenha segredos somente no backend;
- não registre credenciais em logs ou capturas;
- desabilite dados de demonstração em produção;
- revise `ALLOWED_HOSTS`, `ALLOWED_ORIGINS` e cookies antes da implantação;
- teste restauração de backup antes de depender do ambiente.

---

<div align="center">

<strong>Segurança é uma propriedade contínua do produto.</strong><br />
<sub>GestorIA · responsável por cada empresa e cada decisão.</sub>

</div>
