# Advertências e Ocorrências

## 1. Objetivo

O submódulo de Advertências e Ocorrências registra acontecimentos relevantes relacionados aos funcionários da empresa.

Os registros formam um histórico interno protegido, vinculado ao funcionário e à organização responsável.

## 2. Tipos de registro

A primeira versão aceita:

- `warning`: advertência;
- `incident`: ocorrência;
- `commendation`: elogio;
- `note`: observação interna.

## 3. Classificação

Níveis disponíveis:

- `informational`: informativo;
- `low`: baixo;
- `medium`: médio;
- `high`: alto.

## 4. Situação

Estados disponíveis:

- `open`: registro aberto;
- `resolved`: registro resolvido;
- `cancelled`: registro cancelado.

Registros não serão excluídos fisicamente. Cancelamentos deverão preservar conteúdo, responsáveis e datas.

## 5. Entidade EmployeeRecord

Campos iniciais:

- `id`;
- `organization_id`;
- `employee_id`;
- `recorded_by_id`;
- `updated_by_id`;
- `resolved_by_id`, opcional;
- `cancelled_by_id`, opcional;
- `record_type`;
- `severity`;
- `status`;
- `title`;
- `description`;
- `occurred_at`;
- `resolution_notes`, opcional;
- `cancellation_reason`, opcional;
- `resolved_at`, opcional;
- `cancelled_at`, opcional;
- `created_at`;
- `updated_at`.

## 6. Regras de negócio

- O funcionário deve pertencer à organização autenticada;
- O responsável pelo registro será obtido da sessão;
- O responsável deve possuir vínculo ativo com a organização;
- Título e descrição são obrigatórios;
- Registros resolvidos devem possuir data de resolução;
- Registros cancelados devem possuir motivo, data e responsável;
- Um registro cancelado não poderá voltar ao estado aberto;
- Um registro resolvido não poderá ser cancelado ou reaberto nesta primeira versão;
- Não haverá exclusão física;
- Dados de outra organização nunca poderão ser consultados ou alterados;
- Logs não deverão registrar integralmente o conteúdo das ocorrências.

## 7. Permissões

O módulo reutiliza as permissões existentes da Gestão Interna:

- `management:read`: acesso ao perfil e ao histórico;
- `employees:manage`: criação, edição, resolução e cancelamento.

Matriz aplicada:

| Ação | Owner | Admin | Member |
| --- | --- | --- | --- |
| Consultar registros | Sim | Sim | Não |
| Criar registros | Sim | Sim | Não |
| Editar registros abertos | Sim | Sim | Não |
| Resolver registros | Sim | Sim | Não |
| Cancelar registros | Sim | Sim | Não |

O backend valida novamente os papéis `owner` e `admin`, sendo a autoridade final das permissões.

## 8. API implementada

- `GET /api/management/employees/{employee_id}/records`;
- `POST /api/management/employees/{employee_id}/records`;
- `GET /api/management/employee-records/{record_id}`;
- `PATCH /api/management/employee-records/{record_id}`;
- `POST /api/management/employee-records/{record_id}/resolve`;
- `POST /api/management/employee-records/{record_id}/cancel`.

A listagem aceita filtros opcionais por situação e tipo de registro.

Todos os acessos são isolados pela organização autenticada.

## 9. Frontend implementado

Rotas:

- `/gestao/funcionarios/:employeeId`: perfil com histórico e filtros;
- `/gestao/funcionarios/:employeeId/registros/novo`;
- `/gestao/funcionarios/:employeeId/registros/:recordId`;
- `/gestao/funcionarios/:employeeId/registros/:recordId/editar`.

O perfil do funcionário apresenta:

- histórico de advertências e ocorrências;
- filtros por tipo e situação;
- estados de carregamento, erro e conteúdo vazio;
- acesso ao cadastro de registros;
- acesso aos detalhes;
- edição de registros abertos;
- resolução e cancelamento com justificativa;
- identificação visual da situação e da gravidade.

Os formulários utilizam páginas próprias e responsivas, permitindo expansão futura sem concentrar funcionalidades no perfil do funcionário.

## 10. Fora da primeira versão

- Upload de anexos;
- Assinatura eletrônica do funcionário;
- Confirmação formal de ciência;
- Notificações automáticas;
- Modelos jurídicos de advertência;
- Exportação para PDF;
- Versionamento integral do conteúdo;
- Exclusão física.

## 11. Critérios de aceite

- [x] Migration criada e validada;
- [x] Modelo isolado por organização;
- [x] Schemas com validação;
- [x] Repositório e serviços implementados;
- [x] Regras de transição de situação protegidas;
- [x] API implementada;
- [x] Permissões aplicadas no backend e frontend;
- [x] Histórico exibido no perfil do funcionário;
- [x] Interface responsiva;
- [x] Estados de carregamento, erro e conteúdo vazio;
- [x] Testes automatizados;
- [x] Documentação atualizada.