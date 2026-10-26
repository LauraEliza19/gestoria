# Gestão Interna

## 1. Objetivo

O Módulo Gestor será o centro de controle interno da empresa no GestorIA.

Seu objetivo é apoiar proprietários e administradores no acompanhamento de pessoas, centros de custo, agenda, movimentações financeiras e indicadores operacionais.

O módulo deve respeitar o isolamento entre empresas, as permissões do usuário e a proteção de informações pessoais, salariais e financeiras.

## 2. Limites do domínio

A Gestão Interna será dividida nos seguintes submódulos:

- Painel executivo;
- Funcionários;
- Vínculos profissionais;
- Centros de custo;
- Agenda empresarial;
- Financeiro;
- Ponto eletrônico;
- Folha e holerites;
- Relatórios.

Cada submódulo deve possuir responsabilidades próprias. O Módulo Gestor poderá consolidar informações de vendas, pedidos, produção e financeiro, mas não deverá duplicar regras pertencentes a esses domínios.

## 3. Estado atual

A fundação da Gestão Interna foi concluída em 5 de outubro de 2026 e
posteriormente ampliada com vínculos profissionais e registros administrativos.

Funcionalidades entregues:

- Entrada da Gestão Interna na navegação superior;
- Painel executivo com indicadores;
- Cadastro, consulta, edição, ativação e desativação de funcionários;
- Perfil individual do funcionário;
- Histórico de vínculos profissionais;
- Cadastro e edição de vínculos profissionais;
- Proteção específica das informações salariais;
- Cadastro, consulta, edição, busca, filtro, ativação e desativação de centros de custo;
- Páginas próprias e expansíveis para cadastro e edição;
- Permissões visuais e validações obrigatórias no backend;
- Isolamento dos dados por organização;
- Estados de carregamento, erro e conteúdo vazio;
- Interface responsiva;
- Testes automatizados;
- Documentação técnica;
- Advertências, ocorrências, observações e elogios;
- Fluxos de abertura, edição, resolução e cancelamento de registros;
- Auditoria do responsável por criar e alterar registros;
- Resumo de funcionários, vínculos, afastamentos e centros de custo no
  dashboard executivo.

Não fazem parte desta primeira versão:

- Cálculo de folha de pagamento;
- Registro oficial de ponto;
- Emissão de holerites;
- Agenda completa;
- Conciliação bancária;
- Relatórios contábeis;
- Cálculo contábil oficial de lucro ou prejuízo.

## 4. Relação com o Financeiro

O núcleo financeiro foi implementado por Adryan e está disponível no backend e
na aplicação web. Ele mantém categorias, lançamentos, filtros, resumo de
entradas, saídas e saldo, além de auditoria.

A Gestão Interna e o Financeiro permanecem como domínios independentes. Uma
integração futura poderá consolidar:

- Total de receitas;
- Total de despesas;
- Saldo do período;
- Contas pendentes;
- Movimentações por centro de custo.

A Gestão Interna não cria modelos financeiros duplicados. Embora vínculos
profissionais já possam apontar para centros de custo, os lançamentos
financeiros ainda não possuem `cost_center_id`; portanto, movimentações por
centro de custo continuam planejadas e não devem ser exibidas como disponíveis.

## 5. Entidades iniciais

### 5.1 Employee

Representa uma pessoa que trabalha para a empresa.

Um funcionário não é obrigatoriamente um usuário do GestorIA. O vínculo com uma conta de acesso será opcional.

Campos planejados:

- `id`;
- `organization_id`;
- `user_id`, opcional;
- `full_name`;
- `document`, opcional;
- `email`, opcional;
- `phone`, opcional;
- `birth_date`, opcional;
- `is_active`;
- `created_at`;
- `updated_at`.

Regras:

- Todos os registros pertencem a uma organização;
- O documento deve ser normalizado antes da persistência;
- Quando informado, o documento deve ser único dentro da empresa;
- O usuário vinculado deve participar da mesma organização;
- Desativar um funcionário não deve apagar seu histórico;
- Dados pessoais não devem aparecer para usuários sem permissão.

### 5.2 Employment

Representa um vínculo profissional e preserva seu histórico.

Campos planejados:

- `id`;
- `organization_id`;
- `employee_id`;
- `cost_center_id`, opcional;
- `position_title`;
- `employment_type`;
- `status`;
- `started_at`;
- `ended_at`, opcional;
- `base_salary`, opcional;
- `notes`, opcional;
- `created_at`;
- `updated_at`.

Regras:

- O funcionário e o centro de custo devem pertencer à mesma empresa;
- A data de desligamento não pode ser anterior à admissão;
- O salário-base não pode ser negativo;
- Informações salariais não serão retornadas nas listagens comuns;
- Alterações em salário e vínculo deverão ser auditáveis;
- O histórico não será apagado ao encerrar um vínculo.

### 5.3 CostCenter

Representa uma área utilizada para organizar funcionários e movimentações financeiras.

Campos planejados:

- `id`;
- `organization_id`;
- `code`;
- `name`;
- `description`, opcional;
- `is_active`;
- `created_at`;
- `updated_at`.

Regras:

- Código e nome devem ser únicos dentro da empresa;
- Um centro de custo utilizado não deve ser excluído fisicamente;
- Centros de custo inativos continuam disponíveis no histórico;
- Movimentações financeiras poderão referenciar um centro de custo.

## 6. Permissões implementadas

Permissões disponíveis:

- `management:read`;
- `employees:manage`;
- `employee_compensation:read`;
- `cost_centers:manage`.

Matriz atual:

| Ação | Owner | Admin | Member |
| --- | --- | --- | --- |
| Acessar a Gestão Interna | Sim | Sim | Não |
| Consultar funcionários | Sim | Sim | Não |
| Cadastrar e editar funcionários | Sim | Sim | Não |
| Consultar salário-base | Sim | Não | Não |
| Consultar centros de custo | Sim | Sim | Não |
| Gerenciar centros de custo | Sim | Sim | Não |

As permissões financeiras foram adicionadas ao domínio financeiro. `owner` e
`admin` podem gerenciar categorias e lançamentos; um `member` só pode ler o
módulo quando seu acesso financeiro tiver sido aprovado. Essas regras não são
duplicadas pela Gestão Interna.

O frontend controla a experiência visual, mas o backend permanece como autoridade final das permissões.

## 7. API implementada

Rotas disponíveis:

- `GET /api/management/overview`;
- `GET /api/management/employees`;
- `POST /api/management/employees`;
- `GET /api/management/employees/{employee_id}`;
- `PATCH /api/management/employees/{employee_id}`;
- `GET /api/management/employees/{employee_id}/employments`;
- `POST /api/management/employees/{employee_id}/employments`;
- `PATCH /api/management/employments/{employment_id}`;
- `GET /api/management/employments/{employment_id}/compensation`;
- `GET /api/management/cost-centers`;
- `GET /api/management/cost-centers/{cost_center_id}`;
- `POST /api/management/cost-centers`;
- `PATCH /api/management/cost-centers/{cost_center_id}`.

Todas as consultas utilizam o `organization_id` da sessão autenticada. O cliente não escolhe livremente a organização da operação.

## 8. Frontend implementado

Rotas disponíveis:

- `/gestao`;
- `/gestao/funcionarios`;
- `/gestao/funcionarios/novo`;
- `/gestao/funcionarios/:employeeId`;
- `/gestao/funcionarios/:employeeId/editar`;
- `/gestao/funcionarios/:employeeId/vinculos/novo`;
- `/gestao/funcionarios/:employeeId/vinculos/:employmentId/editar`;
- `/gestao/centros-de-custo`;
- `/gestao/centros-de-custo/novo`;
- `/gestao/centros-de-custo/:costCenterId/editar`.

Principais componentes:

- `ManagementPage`;
- `EmployeesPage`;
- `EmployeeFormPage`;
- `EmployeeProfilePage`;
- `EmploymentFormPage`;
- `EmployeeRecordsPanel`;
- `EmployeeRecordFormPage`;
- `EmployeeRecordDetailPage`;
- `CostCentersPage`;
- `CostCenterFormPage`;
- `managementTypes`;
- `useManagement`;
- `management.service`.

A navegação e as páginas foram preparadas para desktop, tablet e dispositivos móveis.

## 9. Painel executivo

O painel próprio da Gestão Interna apresenta:

- quantidade total de funcionários;
- quantidade de funcionários ativos;
- quantidade de centros de custo ativos;
- vínculos profissionais ativos;
- funcionários afastados.

O dashboard executivo geral também pode apresentar funcionários ativos e
ocorrências abertas. Valores financeiros vêm exclusivamente da API financeira,
quando o usuário possui acesso.

O painel não deverá apresentar movimentação financeira como lucro contábil sem que custos, competência e demais regras tenham sido definidos.

## 10. Segurança e privacidade

- Informações devem ser isoladas por empresa;
- Salários e documentos pessoais são dados restritos;
- A API não deve confiar apenas nas permissões visuais;
- Alterações sensíveis devem identificar o usuário responsável;
- Logs não devem registrar documentos ou salários integralmente;
- Exclusões devem preservar históricos necessários;
- Exportações futuras deverão respeitar permissões;
- O módulo deverá seguir as políticas de sessão e CSRF já existentes.

## 11. Critérios de aceite

- [x] O módulo aparece na navegação;
- [x] O painel inicial pode ser acessado;
- [x] Funcionários podem ser cadastrados e listados;
- [x] Um funcionário pode possuir vínculo profissional;
- [x] Centros de custo podem ser cadastrados;
- [x] Papéis e permissões são respeitados;
- [x] Dados não vazam entre empresas;
- [x] Salários não aparecem sem autorização;
- [x] A interface funciona em desktop e celular;
- [x] Existem estados de carregamento, erro e lista vazia;
- [x] Testes de backend e frontend foram adicionados;
- [x] Ruff e o formatador foram aprovados;
- [x] Pytest foi aprovado;
- [x] Lint, typecheck, testes e build do frontend foram aprovados;
- [x] A documentação foi atualizada;
- [x] Registros administrativos podem ser criados e consultados;
- [x] Ocorrências abertas podem ser resolvidas ou canceladas;
- [x] O autor e os responsáveis pelas alterações ficam registrados;
- [x] Indicadores da equipe alimentam o dashboard executivo.

## 12. Validação técnica

Resultados registrados em 5 de outubro de 2026:

- Prettier aprovado;
- TypeScript aprovado;
- 20 testes do frontend aprovados;
- Build de produção do frontend concluído;
- Lint sem erros e com cinco avisos preexistentes;
- Ruff aprovado em `app`, `tests` e migrations;
- 110 arquivos Python formatados;
- 240 testes do backend aprovados;
- 14 testes ignorados conforme configuração da suíte;
- Fluxo integrado de funcionário, vínculo e centro de custo aprovado no navegador;
- Remuneração do funcionário protegida por permissão;
- Nenhum erro encontrado no console durante a validação da Gestão Interna.

Na data dessa validação, havia cinco avisos preexistentes no frontend,
registrados em `SessionContext`, `ProductsPage`, `OrdersPage` e
`CustomersPage`. Essa observação é histórica e não afirma o estado atual do lint.

## 13. Evoluções posteriores

Após a primeira versão:

1. Agenda empresarial;
2. Armazenamento seguro de documentos;
3. Ponto eletrônico;
4. Holerites;
5. Folha de pagamento;
6. Relatórios gerenciais;
7. Vínculo entre lançamentos financeiros e centros de custo;
8. Ampliação das consultas do Copiloto sobre equipe e centros de custo;
9. Exportação e integrações externas.
