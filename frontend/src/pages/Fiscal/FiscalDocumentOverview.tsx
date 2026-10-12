import { Link } from 'react-router-dom'
import type { FiscalDocument, FiscalOrganization } from './fiscalTypes'
import {
  FISCAL_MODEL_NAMES,
  FISCAL_SNAPSHOT_LABELS,
  fiscalParties,
  fiscalStatusClass,
  fiscalStatusMeta,
  formatFiscalDate,
  formatFiscalDateTime,
  formatFiscalMoney,
  formatTaxId,
} from './fiscalUtils'

type FiscalDocumentOverviewProps = {
  document: FiscalDocument
  organization?: FiscalOrganization
}

export function FiscalDocumentOverview({ document, organization }: FiscalDocumentOverviewProps) {
  const statusMeta = fiscalStatusMeta(document.status)
  const { emitter, recipient } = fiscalParties(document, organization)

  return (
    <div className="space-y-5">
      <div className="fiscal-detail-title">
        <div>
          <p className="eyebrow">Dados da nota</p>
          <h2>
            {FISCAL_MODEL_NAMES[document.model] || document.model} {document.number}
          </h2>
        </div>
        <div className="fiscal-status-context">
          <span className={fiscalStatusClass(document.status)}>{statusMeta.label}</span>
          <p>{statusMeta.description}</p>
        </div>
      </div>

      <section>
        <h3 className="fiscal-modal-subtitle">Dados gerais</h3>
        <div className="detail-grid">
          <span>
            Modelo
            <strong>
              {document.model} · {FISCAL_MODEL_NAMES[document.model] || document.model}
            </strong>
          </span>
          <span>
            Série / número
            <strong>
              {document.series} / {document.number}
            </strong>
          </span>
          <span>
            Valor total
            <strong>{formatFiscalMoney(document.value)}</strong>
          </span>
          <span>
            Data de emissão
            <strong>{formatFiscalDate(document.issue_date)}</strong>
          </span>
          <span>
            Tipo de operação
            <strong>{document.document_type === 'saida' ? '1 - Saída' : '0 - Entrada'}</strong>
          </span>
          <span>
            CFOP
            <strong>{document.cfop || 'Não informado'}</strong>
          </span>
          <span className="md:col-span-3">
            Natureza da operação
            <strong>{document.operation_nature || 'Não informada'}</strong>
          </span>
        </div>
      </section>

      <section>
        <h3 className="fiscal-modal-subtitle">Emitente</h3>
        <div className="detail-grid">
          <span className="md:col-span-2">
            Nome / razão social
            <strong>{emitter.name}</strong>
          </span>
          <span>
            CPF/CNPJ
            <strong>{formatTaxId(emitter.document)}</strong>
          </span>
        </div>
      </section>

      <section>
        <h3 className="fiscal-modal-subtitle">Destinatário</h3>
        <div className="detail-grid">
          <span className="md:col-span-2">
            Nome / razão social
            <strong>{recipient.name}</strong>
          </span>
          <span>
            CPF/CNPJ
            <strong>{formatTaxId(recipient.document)}</strong>
          </span>
        </div>
      </section>

      <section>
        <h3 className="fiscal-modal-subtitle">Autorização e registro</h3>
        <div className="detail-grid">
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
            Cadastro
            <strong>{formatFiscalDateTime(document.created_at)}</strong>
          </span>
          <span>
            Responsável original
            <strong>{document.created_by_id || 'Não registrado no histórico antigo'}</strong>
          </span>
          <span>
            Pedido
            <strong>
              {document.order_id ? (
                <Link to={`/pedidos?order_id=${document.order_id}`}>
                  Consultar pedido {document.order_id.slice(0, 8)}
                </Link>
              ) : (
                'Sem pedido de venda'
              )}
            </strong>
          </span>
          <span>
            Origem dos itens
            <strong>
              {FISCAL_SNAPSHOT_LABELS[document.snapshot_source] || 'Capturados no registro'}
            </strong>
          </span>
          <span className="md:col-span-3">
            Chave de acesso
            <strong className="font-mono">{document.access_key || 'Não informada'}</strong>
          </span>
        </div>
      </section>

      {document.cancellation_reason && (
        <p className="info-note">Motivo do cancelamento: {document.cancellation_reason}</p>
      )}

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
    </div>
  )
}
