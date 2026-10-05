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

## 3. Responsabilidades da primeira versão

A primeira versão incluirá:

- Entrada do Módulo Gestor na navegação;
- Painel executivo inicial;
- Cadastro e listagem de funcionários;
- Histórico de vínculos profissionais;
- Cadastro e listagem de centros de custo;
- Permissões de acesso;
- Estados de carregamento, erro e conteúdo vazio;
- Interface responsiva;
- Testes automatizados;
- Documentação técnica.

Não fazem parte da primeira versão:

- Cálculo de folha de pagamento;
- Registro oficial de ponto;
- Emissão de holerites;
- Advertências;
- Agenda completa;
- Conciliação bancária;
- Relatórios contábeis;
- Cálculo contábil oficial de lucro ou prejuízo.

## 4. Integração com o financeiro

O núcleo financeiro será desenvolvido por Adryan e integrado ao painel do Módulo Gestor.

A Gestão Interna poderá consumir:

- Total de receitas;
- Total de despesas;
- Saldo do período;
- Contas pendentes;
- Movimentações por centro de custo.

A Gestão Interna não criará modelos financeiros duplicados.

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

## 6. Permissões

Permissões planejadas:

- `management:read`;
- `employees:read`;
- `employees:manage`;
- `employee_compensation:read`;
- `cost_centers:read`;
- `cost_centers:manage`;
- `finance:read`;
- `finance:manage`.

Matriz inicial:

| Ação | Owner | Admin | Member |
| --- | --- | --- | --- |
| Acessar o Módulo Gestor | Sim | Sim | Não |
| Consultar funcionários | Sim | Sim | Não |
| Cadastrar e editar funcionários | Sim | Sim | Não |
| Consultar salário-base | Sim | Não | Não |
| Consultar centros de custo | Sim | Sim | Não |
| Gerenciar centros de custo | Sim | Sim | Não |
| Consultar financeiro | Sim | Sim | Não |
| Gerenciar financeiro | Sim | Sim | Não |

O frontend utilizará as permissões para controlar a experiência visual, mas o backend será a autoridade final.

## 7. API planejada

Rotas iniciais:

- `GET /api/management/overview`;
- `GET /api/management/employees`;
- `POST /api/management/employees`;
- `GET /api/management/employees/{employee_id}`;
- `PATCH /api/management/employees/{employee_id}`;
- `GET /api/management/employees/{employee_id}/employments`;
- `POST /api/management/employees/{employee_id}/employments`;
- `PATCH /api/management/employments/{employment_id}`;
- `GET /api/management/cost-centers`;
- `POST /api/management/cost-centers`;
- `PATCH /api/management/cost-centers/{cost_center_id}`.

Todas as consultas deverão utilizar o `organization_id` da sessão autenticada. O cliente nunca escolherá livremente a organização da operação.

## 8. Frontend planejado

Rotas iniciais:

- `/gestao`;
- `/gestao/funcionarios`;
- `/gestao/funcionarios/novo`;
- `/gestao/funcionarios/:employeeId`;
- `/gestao/centros-de-custo`.

Estrutura sugerida:

- `ManagementPage`;
- `ManagementOverview`;
- `EmployeesPage`;
- `EmployeeFormPage`;
- `EmployeeProfilePage`;
- `CostCentersPage`;
- `managementTypes`;
- `useManagement`.

A navegação deverá funcionar em desktop e dispositivos móveis.

## 9. Painel executivo inicial

A primeira versão poderá apresentar:

- Quantidade de funcionários ativos;
- Quantidade de centros de custo ativos;
- Faturamento concluído;
- Pedidos em produção;
- Receitas e despesas, quando a API financeira estiver disponível;
- Alertas operacionais.

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

## 11. Critérios de aceite da primeira versão

- [ ] O módulo aparece na navegação;
- [ ] O painel inicial pode ser acessado;
- [ ] Funcionários podem ser cadastrados e listados;
- [ ] Um funcionário pode possuir vínculo profissional;
- [ ] Centros de custo podem ser cadastrados;
- [ ] Papéis e permissões são respeitados;
- [ ] Dados não vazam entre empresas;
- [ ] Salários não aparecem sem autorização;
- [ ] A interface funciona em desktop e celular;
- [ ] Existem estados de carregamento, erro e lista vazia;
- [ ] Testes de backend e frontend foram adicionados;
- [ ] Ruff e o formatador foram aprovados;
- [ ] Pytest foi aprovado;
- [ ] Lint, typecheck, testes e build do frontend foram aprovados;
- [ ] A documentação foi atualizada.

## 12. Evoluções posteriores

Após a primeira versão:

1. Agenda empresarial;
2. Advertências e ocorrências;
3. Armazenamento seguro de documentos;
4. Ponto eletrônico;
5. Holerites;
6. Folha de pagamento;
7. Relatórios gerenciais;
8. Indicadores financeiros;
9. Integração com o Copiloto;
10. Exportação e integrações externas.