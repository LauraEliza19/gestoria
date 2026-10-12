import { Copy, Download, Printer, X } from 'lucide-react'

type FiscalToolbarProps = {
  selectedCount: number
  visibleCount: number
  onExport: () => void
  onPrint: () => void
  onCopyKeys: () => void
  onClearSelection: () => void
}

export function FiscalToolbar({
  selectedCount,
  visibleCount,
  onExport,
  onPrint,
  onCopyKeys,
  onClearSelection,
}: FiscalToolbarProps) {
  const hasSelection = selectedCount > 0

  return (
    <div className="fiscal-toolbar" role="toolbar" aria-label="Ações das notas">
      <div className="fiscal-toolbar-actions">
        <button
          className="secondary-button"
          disabled={visibleCount === 0}
          type="button"
          title={hasSelection ? 'Exportar notas selecionadas' : 'Exportar todas as notas filtradas'}
          onClick={onExport}
        >
          <Download size={16} aria-hidden="true" />
          Exportar CSV
        </button>

        <button
          className="secondary-button"
          disabled={!hasSelection}
          type="button"
          onClick={onPrint}
        >
          <Printer size={16} aria-hidden="true" />
          Imprimir
        </button>

        <button
          className="secondary-button"
          disabled={!hasSelection}
          type="button"
          onClick={onCopyKeys}
        >
          <Copy size={16} aria-hidden="true" />
          Copiar chaves
        </button>
      </div>

      <p className="fiscal-toolbar-count" aria-live="polite">
        {hasSelection ? (
          <>
            <strong>{selectedCount}</strong> {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
            <button type="button" onClick={onClearSelection}>
              <X size={14} aria-hidden="true" />
              Limpar seleção
            </button>
          </>
        ) : (
          'Selecione notas para imprimir ou copiar chaves.'
        )}
      </p>
    </div>
  )
}
