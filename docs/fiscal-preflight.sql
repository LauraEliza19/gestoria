-- Read-only inventory BEFORE revision 0006_fiscal_integrity.
-- Run after 0005_fiscal_documents exists. No automatic remediation.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT version_num AS revisao_aplicada FROM alembic_version;

-- Blocker: more than one active outgoing document for the same order.
SELECT organization_id, order_id, count(*) AS quantidade,
       array_agg(id) AS notas
FROM fiscal_documents
WHERE document_type='saida' AND order_id IS NOT NULL
  AND status IN ('Autorizada','Em processamento')
GROUP BY organization_id, order_id HAVING count(*) > 1;

-- Blocker: repeated numbering, INCLUDING cancelled documents.
SELECT organization_id, model, series, number, count(*) AS quantidade,
       array_agg(id) AS notas
FROM fiscal_documents WHERE document_type='saida'
GROUP BY organization_id, model, series, number HAVING count(*) > 1;

-- Blocker: cross-tenant association or incoming document with sales order.
SELECT f.id, f.organization_id, f.order_id, f.document_type,
       o.organization_id AS empresa_pedido, c.organization_id AS empresa_cliente
FROM fiscal_documents f
LEFT JOIN orders o ON o.id=f.order_id
LEFT JOIN customers c ON c.id=o.customer_id
WHERE f.order_id IS NOT NULL AND
 (f.document_type='entrada' OR o.id IS NULL OR
  o.organization_id<>f.organization_id OR c.organization_id<>f.organization_id);

-- Retained historical records: reconcile explicitly after migration.
SELECT id, organization_id, number, participant_name, value, status
FROM fiscal_documents WHERE document_type='saida' AND order_id IS NULL
ORDER BY organization_id, issue_date;

-- Existing linked records may need customer/value review before item capture.
SELECT f.id, f.order_id, f.value AS valor_nota, o.total_amount AS valor_pedido,
       f.participant_name, c.name AS cliente
FROM fiscal_documents f JOIN orders o ON o.id=f.order_id
JOIN customers c ON c.id=o.customer_id
WHERE f.document_type='saida' AND
 (f.value<>o.total_amount OR lower(trim(f.participant_name))<>lower(trim(c.name)));
COMMIT;
