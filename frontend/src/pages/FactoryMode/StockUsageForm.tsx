import { useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { StockItem } from './productionTypes'
import { defaultUsageUnit, friendlyAmount, parseUsage, usageSuggestions } from './stockUsage'

export function StockUsageForm({
  stock,
  busy,
  onSave,
  onCancel,
}: {
  stock: StockItem
  busy: boolean
  onSave: (quantity: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const helpId = useId()
  const result = parseUsage(text, stock.unit, stock.quantity)
  const valid = result.quantity !== undefined
  const available = Math.round(Number(stock.quantity) * 1000)
  const used = result.milli ?? 0
  const remaining = (available - used) / 1000
  const unit = defaultUsageUnit(stock.unit)
  const step = stock.unit === 'kg' || stock.unit === 'L' ? 100 : stock.unit === 'un' ? 1000 : 100000
  const examples =
    unit === 'g'
      ? '800g, meio quilo ou metade'
      : unit === 'ml'
        ? '250ml, meio litro ou metade'
        : '2 unidades ou metade'
  const unitName = unit === 'g' ? 'gramas' : unit === 'ml' ? 'mililitros' : 'unidades'
  const amount = valid ? friendlyAmount(result.quantity, stock.unit) : ''
  function choose(milli: number) {
    setText(friendlyAmount(Math.max(0, Math.min(available, milli)) / 1000, stock.unit))
  }
  return (
    <form
      className="w-full max-w-lg rounded-lg border border-line bg-paper p-3"
      aria-label={`Registrar uso de ${stock.name}`}
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && !busy) onSave(result.quantity)
      }}
    >
      <fieldset disabled={busy} className="grid gap-2">
        <label className="grid gap-1.5 text-sm font-semibold">
          <span className="flex flex-wrap items-center justify-between gap-1">
            Quanto você usou?
            <span className="text-xs font-normal text-muted">
              Saldo: {friendlyAmount(stock.quantity, stock.unit)}
            </span>
          </span>
          <input
            className="form-input !min-h-0 !py-2 !text-sm"
            type="text"
            required
            maxLength={80}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`Ex.: ${examples}`}
            aria-describedby={helpId}
            aria-invalid={text.trim() !== '' && !valid}
            autoComplete="off"
          />
        </label>
        <p id={helpId} className="text-xs text-muted">
          Sem unidade, consideramos {unitName}.
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quantidades rápidas">
          {[...usageSuggestions(stock.unit), 'metade', 'tudo'].map((suggestion) => {
            const option = parseUsage(suggestion, stock.unit, stock.quantity)
            return (
              <button
                key={suggestion}
                type="button"
                className="min-h-8 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold hover:border-[#28745b] disabled:opacity-40 aria-pressed:border-[#28745b] aria-pressed:bg-[#effbf6] aria-pressed:text-[#28745b]"
                disabled={option.quantity === undefined}
                aria-pressed={valid && option.quantity === result.quantity}
                onClick={() => setText(suggestion)}
              >
                {suggestion === 'metade' ? 'Metade' : suggestion === 'tudo' ? 'Tudo' : suggestion}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="secondary-button !min-h-8 !p-1.5"
            aria-label="Usar menos"
            disabled={used <= 0}
            onClick={() => choose(used - step)}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <input
            className="min-w-0 flex-1 accent-[#28745b]"
            type="range"
            min={0}
            max={available}
            step={1}
            value={used}
            onChange={(event) => choose(Number(event.target.value))}
            aria-label="Ajustar quantidade utilizada"
            aria-valuetext={friendlyAmount(used / 1000, stock.unit)}
          />
          <button
            type="button"
            className="secondary-button !min-h-8 !p-1.5"
            aria-label="Usar mais"
            disabled={used >= available}
            onClick={() => choose(used + step)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
        <div aria-live="polite" aria-atomic="true">
          {valid ? (
            <p className="text-sm text-muted">
              Usou <strong className="text-ink">{amount}</strong>
              {' · '}
              {used === available ? (
                'O estoque ficará zerado.'
              ) : (
                <>
                  Sobram{' '}
                  <strong className="text-signal-dark">
                    {friendlyAmount(remaining, stock.unit)}
                  </strong>
                </>
              )}
            </p>
          ) : text.trim() ? (
            <p className="text-xs text-[#a52c42]">{result.error}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="primary-button !min-h-9 !px-3 !py-1.5 !text-sm"
            disabled={!valid || busy}
          >
            {busy ? 'Salvando...' : valid ? `Usei ${amount}` : 'Registrar uso'}
          </button>
          <button
            type="button"
            className="secondary-button !min-h-9 !px-3 !py-1.5 !text-sm"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  )
}
