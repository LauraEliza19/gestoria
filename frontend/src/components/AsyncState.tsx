import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'

type LoadingStateProps = {
  message?: string
}

export function LoadingState({ message = 'Carregando informações...' }: LoadingStateProps) {
  return (
    <div
      className="grid justify-items-center gap-3 rounded-lg bg-paper p-8 text-center text-sm text-muted"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <LoaderCircle className="motion-safe:animate-spin text-signal" size={24} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

type ErrorStateProps = {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="grid justify-items-center gap-3 rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-6 text-center text-sm text-[#a52c42]"
      role="alert"
    >
      <AlertCircle size={24} aria-hidden="true" />

      <p>{message}</p>

      {onRetry && (
        <button className="secondary-button" type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}

type EmptyStateProps = {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg bg-paper p-8 text-center">
      <Inbox className="text-muted" size={26} aria-hidden="true" />

      <strong className="text-sm text-ink">{title}</strong>

      {description && <p className="max-w-md text-xs leading-5 text-muted">{description}</p>}
    </div>
  )
}
