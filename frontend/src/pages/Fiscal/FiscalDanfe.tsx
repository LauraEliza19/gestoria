import type { FiscalDocument, FiscalOrganization } from './fiscalTypes'
import {
  FISCAL_MODEL_NAMES,
  fiscalItemTotal,
  fiscalParties,
  formatAccessKey,
  formatFiscalDate,
  formatFiscalDateTime,
  formatFiscalMoney,
  formatQuantity,
  formatTaxId,
} from './fiscalUtils'

type FiscalDanfeProps = {
  document: FiscalDocument
  organization?: FiscalOrganization
}

function organizationAddress(organization?: FiscalOrganization): string[] {
  if (!organization) {
    return []
  }

  const street = [organization.street, organization.number, organization.complement]
    .filter(Boolean)
    .join(', ')
  const city = [organization.neighborhood, organization.city, organization.state]
    .filter(Boolean)
    .join(' - ')

  return [street, city, organization.postal_code ? `CEP ${organization.postal_code}` : '']
    .concat(organization.phone ? [`Fone: ${organization.phone}`] : [])
    .filter(Boolean) as string[]
}

export function FiscalDanfe({ document, organization }: FiscalDanfeProps) {
  const { emitter, recipient } = fiscalParties(document, organization)
  const isOutgoing = document.document_type === 'saida'
  const productsTotal = document.items.reduce((sum, item) => sum + fiscalItemTotal(item), 0)
  const address = isOutgoing ? organizationAddress(organization) : []

  return (
    <article className="fiscal-danfe">
      <p className="fiscal-danfe-notice">
        Representação simplificada gerada pelo GestorIA a partir dos dados registrados. Não
        substitui o DANFE oficial emitido pelo serviço fiscal.
      </p>

      <div className="fiscal-danfe-head">
        <div className="fiscal-danfe-box">
          <small>Identificação do emitente</small>
          <strong className="text-base">{emitter.name}</strong>
          {address.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>

        <div className="fiscal-danfe-box text-center">
          <strong>DANFE</strong>
          <span>Documento auxiliar da nota fiscal</span>
          <span>{isOutgoing ? '1 - Saída' : '0 - Entrada'}</span>
          <strong>Nº {document.number}</strong>
          <span>Série {document.series}</span>
          <span>{FISCAL_MODEL_NAMES[document.model] || document.model}</span>
        </div>

        <div className="fiscal-danfe-box">
          <small>Chave de acesso</small>
          <strong className="font-mono text-[12px]">{formatAccessKey(document.access_key)}</strong>
          <span>
            Consulta de autenticidade no portal nacional da NF-e ou no site da Sefaz autorizadora.
          </span>
        </div>
      </div>

      <div className="fiscal-danfe-grid fiscal-danfe-grid-2">
        <div className="fiscal-danfe-field">
          <small>Natureza da operação</small>
          <span>{document.operation_nature || 'Não informada'}</span>
        </div>
        <div className="fiscal-danfe-field">
          <small>Protocolo de autorização de uso</small>
          <span>
            {document.authorization_protocol
              ? `${document.authorization_protocol} - ${formatFiscalDateTime(document.authorized_at)}`
              : 'Sem protocolo registrado'}
          </span>
        </div>
      </div>

      <div className="fiscal-danfe-grid fiscal-danfe-grid-3">
        <div className="fiscal-danfe-field">
          <small>Inscrição estadual</small>
          <span>{(isOutgoing && organization?.state_registration) || 'Não informada'}</span>
        </div>
        <div className="fiscal-danfe-field">
          <small>CFOP</small>
          <span>{document.cfop || 'Não informado'}</span>
        </div>
        <div className="fiscal-danfe-field">
          <small>CNPJ / CPF</small>
          <span>{formatTaxId(emitter.document)}</span>
        </div>
      </div>

      <h4 className="fiscal-danfe-section">{isOutgoing ? 'Destinatário' : 'Remetente'}</h4>
      <div className="fiscal-danfe-grid fiscal-danfe-grid-3">
        <div className="fiscal-danfe-field">
          <small>Nome / razão social</small>
          <span>{isOutgoing ? recipient.name : emitter.name}</span>
        </div>
        <div className="fiscal-danfe-field">
          <small>CNPJ / CPF</small>
          <span>{formatTaxId(isOutgoing ? recipient.document : emitter.document)}</span>
        </div>
        <div className="fiscal-danfe-field">
          <small>Data da emissão</small>
          <span>{formatFiscalDate(document.issue_date)}</span>
        </div>
      </div>

      <h4 className="fiscal-danfe-section">Cálculo do imposto</h4>
      <div className="fiscal-danfe-grid fiscal-danfe-grid-3">
        <div className="fiscal-danfe-field">
          <small>Valor total dos produtos</small>
          <span>{formatFiscalMoney(String(productsTotal))}</span>
        </div>
        <div className="fiscal-danfe-field">
          <small>Situação no GestorIA</small>
          <span>{document.status}</span>
        </div>
        <div className="fiscal-danfe-field">
          <small>Valor total da nota</small>
          <strong>{formatFiscalMoney(document.value)}</strong>
        </div>
      </div>

      <h4 className="fiscal-danfe-section">Dados do produto / serviço</h4>
      <div className="fiscal-danfe-items">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>NCM</th>
              <th>Unid.</th>
              <th>Qtd.</th>
              <th>Valor unit.</th>
              <th>Valor total</th>
            </tr>
          </thead>
          <tbody>
            {document.items.length > 0 ? (
              document.items.map((item, index) => (
                <tr key={item.id || `${item.product_id}-${index}`}>
                  <td>{item.product_name}</td>
                  <td>{item.fiscal_snapshot?.ncm_code || '—'}</td>
                  <td>{item.unit_of_measure || '—'}</td>
                  <td>{formatQuantity(item.quantity)}</td>
                  <td>{formatFiscalMoney(item.unit_price)}</td>
                  <td>{formatFiscalMoney(String(fiscalItemTotal(item)))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>Nenhum item registrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {document.status === 'Cancelada' && <p className="fiscal-danfe-stamp">Nota cancelada</p>}
    </article>
  )
}
