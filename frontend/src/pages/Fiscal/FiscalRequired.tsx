// Marcação visual padronizada para campos obrigatórios do módulo fiscal.
export function RequiredMark() {
  return (
    <>
      <span className="fiscal-required" aria-hidden="true">
        {' '}
        *
      </span>
      <span className="sr-only"> (obrigatório)</span>
    </>
  )
}

export function RequiredLegend() {
  return (
    <p className="fiscal-required-legend">
      Campos marcados com <span className="fiscal-required">*</span> são obrigatórios.
    </p>
  )
}
