import type { FiscalDocumentType } from './fiscalTypes'
import { FISCAL_STATUSES } from './fiscalUtils'

type FiscalFiltersProps = {
  type: FiscalDocumentType
  search: string
  statusFilter: string
  dateFrom: string
  dateTo: string
  counts: Record<FiscalDocumentType, number>
  busy: boolean
  onTypeChange: (type: FiscalDocumentType) => void
  onSearchChange: (search: string) => void
  onStatusFilterChange: (status: string) => void
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  onClear: () => void
  onRefresh: () => void
}

export function FiscalFilters({
  type,
  search,
  statusFilter,
  dateFrom,
  dateTo,
  counts,
  busy,
  onTypeChange,
  onSearchChange,
  onStatusFilterChange,
  onDateFromChange,
  onDateToChange,
  onClear,
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
          Saídas <small>{counts.saida}</small>
        </button>

        <button
          className={type === 'entrada' ? 'active' : ''}
          type="button"
          onClick={() => onTypeChange('entrada')}
        >
          Entradas <small>{counts.entrada}</small>
        </button>
      </div>

      <div className="fiscal-filters">
        <input
          aria-label="Buscar notas"
          placeholder="Participante, CPF/CNPJ, número ou chave"
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

        <label className="fiscal-date-filter">
          <span>Emissão de</span>
          <input
            aria-label="Emissão a partir de"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => onDateFromChange(event.target.value)}
          />
        </label>

        <label className="fiscal-date-filter">
          <span>até</span>
          <input
            aria-label="Emissão até"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => onDateToChange(event.target.value)}
          />
        </label>

        {(search || statusFilter || dateFrom || dateTo) && (
          <button className="secondary-button" type="button" onClick={onClear}>
            Limpar filtros
          </button>
        )}

        <button className="secondary-button" disabled={busy} type="button" onClick={onRefresh}>
          Atualizar
        </button>
      </div>
    </>
  )
}
