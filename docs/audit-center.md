# Central de Auditoria

Acesse **Gestão → Central de Auditoria** (`/auditoria`). Permissão própria audit:read, disponível a proprietários e administradores, validada também no backend.

A camada de consulta usa UNION ALL sobre as quatro tabelas existentes, sempre filtrando pela organização autenticada. Não há migração, cópia nem alteração dos eventos. Filtros, contagem e paginação são executados no banco; a ordenação é por data decrescente, módulo e ID para desempate.

- `GET /api/audit`: items, total, page, page_size, has_next. Padrão de 50 eventos, máximo de 100 por página.
- `GET /api/audit/export`: CSV UTF-8 com BOM, separador ponto e vírgula e todos os eventos filtrados. Exportação incremental, com proteção contra fórmulas de planilhas.
- Filtros compartilhados: module, query, actor, action, entity, result, origin, start_date, end_date. Datas inclusivas em UTC. A interface apresenta horários no fuso do navegador.

## Mapeamento

| Fonte | Entidade/ID | Ação | Resultado | Dados |
| --- | --- | --- | --- | --- |
| finance_audit_events | Categoria ou lançamento / entity_id | event_type | Não registrado | document |
| fiscal_events | Documento fiscal / document_id | action | Não registrado | detail |
| order_audit_events | Operação de pedido / operation_id | event_type | prepared, executed, cancelled ou rejected | document |
| copilot_tool_audit_logs | Execução de ferramenta / id | tool_name | status | Payload omitido (redacted: true) |

O usuário é identificado pelo ID, nome e e-mail atuais. As fontes atuais não possuem campo confiável de origem da operação; origin é unknown. O nome da tabela não é usado como origem. Dados preservam o conteúdo histórico disponível: nem todas as fontes registram valores antes/depois. Uma operação de pedido ainda pode não ter um pedido criado; por isso a entidade é a operação. O payload do Copiloto não é selecionado nem pesquisado: a projeção SQL retorna apenas {redacted: true}, também no CSV. Isso protege inclusive dados históricos e campos sensíveis desconhecidos, sem depender de uma lista de nomes de segredos. Resultados ausentes não são tratados como sucesso.

Paginação por offset pode mudar entre requisições quando novos eventos chegam. A exportação usa uma única consulta ordenada.
