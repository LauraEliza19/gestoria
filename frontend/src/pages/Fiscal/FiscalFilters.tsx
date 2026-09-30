import type { FiscalDocumentType } from './fiscalTypes'
import { FISCAL_STATUSES } from './fiscalUtils'

type FiscalFiltersProps = {
  type: FiscalDocumentType
  search: string
  statusFilter: string
  busy: boolean
  onTypeChange: (type: FiscalDocumentType) => void
  onSearchChange: (search: string) => void
  onStatusFilterChange: (status: string) => void
  onRefresh: () => void
}

export function FiscalFilters({
  type,
  search,
  statusFilter,
  busy,
  onTypeChange,
  onSearchChange,
  onStatusFilterChange,
  onRefresh,
}: FiscalFiltersProps) {
  return (
    <>
      <div className="fiscal-tabs">
        <button
          className={type === 'saida' ? 'active' : ''}
          type="button"
          onClick={() => onTypeChange('saida')}
        >
          Saídas
        </button>

        <button
          className={type === 'entrada' ? 'active' : ''}
          type="button"
          onClick={() => onTypeChange('entrada')}
        >
          Entradas
        </button>
      </div>

      <div className="fiscal-filters">
        <input
          aria-label="Buscar notas"
          placeholder="Participante, número ou chave"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <select
          aria-label="Filtrar status"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          <option value="">Todos os status</option>

          {FISCAL_STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>

        <button className="secondary-button" disabled={busy} type="button" onClick={onRefresh}>
          Atualizar
        </button>
      </div>
    </>
  )
}
