import { useState } from 'react'
import type { ReactNode } from 'react'
import { FiscalDocumentOverview } from './FiscalDocumentOverview'
import { FiscalItems } from './FiscalItems'
import type { FiscalDocument, FiscalOrganization } from './fiscalTypes'

type FiscalDocumentDetailsProps = {
  document: FiscalDocument
  organization?: FiscalOrganization
  initialTab?: string
  actions?: ReactNode
  history: ReactNode
}

export function FiscalDocumentDetails({
  document,
  organization,
  initialTab = 'nfe',
  actions,
  history,
}: FiscalDocumentDetailsProps) {
  const tabs = [
    { key: 'nfe', label: 'Dados da nota' },
    { key: 'items', label: `Produtos e serviços (${document.items.length})` },
    { key: 'history', label: 'Histórico' },
    ...(actions ? [{ key: 'actions', label: 'Ações' }] : []),
  ]
  const [tab, setTab] = useState(tabs.some((item) => item.key === initialTab) ? initialTab : 'nfe')

  return (
    <>
      <div className="fiscal-tabs fiscal-modal-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'nfe' && (
          <FiscalDocumentOverview document={document} organization={organization} />
        )}
        {tab === 'items' && <FiscalItems items={document.items} documentValue={document.value} />}
        {tab === 'history' && history}
        {tab === 'actions' && <div className="space-y-4">{actions}</div>}
      </div>
    </>
  )
}
