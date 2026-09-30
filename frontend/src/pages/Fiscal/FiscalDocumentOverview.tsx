import { Link } from 'react-router-dom'
import { FiscalItems } from './FiscalItems'
import type { FiscalDocument } from './fiscalTypes'
import { formatFiscalDateTime, formatFiscalMoney } from './fiscalUtils'

type FiscalDocumentOverviewProps = {
  document: FiscalDocument
}

export function FiscalDocumentOverview({ document }: FiscalDocumentOverviewProps) {
  return (
    <>
      <h2>
        NF {document.number} · {document.status}
      </h2>

      <div className="detail-grid">
        <span>
          Destinatário / fornecedor
          <strong>{document.participant_name}</strong>
        </span>

        <span>
          CPF/CNPJ
          <strong>{document.participant_document || 'Não informado'}</strong>
        </span>

        <span>
          Pedido
          <strong>{document.order_id || 'Sem pedido de venda'}</strong>
        </span>

        <span>
          Total
          <strong>{formatFiscalMoney(document.value)}</strong>
        </span>

        <span>
          Responsável original
          <strong>{document.created_by_id || 'Não registrado no histórico antigo'}</strong>
        </span>

        <span>
          Cadastro
          <strong>{formatFiscalDateTime(document.created_at)}</strong>
        </span>

        <span>
          Autorização
          <strong>
            {formatFiscalDateTime(document.authorized_at)} ·{' '}
            {document.authorization_protocol || 'Sem protocolo'}
          </strong>
        </span>

        <span>
          Cancelamento
          <strong>
            {formatFiscalDateTime(document.cancelled_at)} ·{' '}
            {document.cancellation_protocol || 'Sem protocolo'}
          </strong>
        </span>

        <span>
          Chave de acesso
          <strong>{document.access_key || 'Não informada'}</strong>
        </span>
      </div>

      {document.order_id && (
        <Link to={`/pedidos?order_id=${document.order_id}`}>Consultar pedido</Link>
      )}

      {document.cancellation_reason && (
        <p>Motivo do cancelamento: {document.cancellation_reason}</p>
      )}

      <FiscalItems items={document.items} />

      {document.snapshot_source === 'reconciled_order' && (
        <p className="info-note">
          Itens recuperados do pedido na conciliação de{' '}
          {formatFiscalDateTime(document.reconciled_at)}. Não representam uma captura feita na
          emissão original.
        </p>
      )}

      {document.snapshot_source === 'legacy_unverified' && (
        <p className="info-note">
          Registro histórico pendente de conciliação. Datas e responsáveis desconhecidos foram
          preservados como não informados. Entradas históricas não geram estoque automaticamente.
        </p>
      )}
    </>
  )
}
