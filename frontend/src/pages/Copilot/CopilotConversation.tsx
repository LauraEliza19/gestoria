import { ArrowRight, RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { COPILOT_SUGGESTIONS } from './copilotData'
import type { CopilotMessage, CopilotResponseStatus } from './copilotTypes'

type CopilotConversationProps = {
  messages: CopilotMessage[]
  input: string
  sending: boolean
  onInputChange: (value: string) => void
  onSend: (prompt?: string) => Promise<void>
  onRetry: (messageId: string, prompt: string) => Promise<void>
}

const STATUS_PRESENTATION: Record<
  CopilotResponseStatus,
  {
    label: string
    className: string
  }
> = {
  answered: {
    label: 'Consulta real',
    className: 'border-[#b7e4cf] bg-[#eefbf5] text-[#18724b]',
  },
  guided: {
    label: 'Orientação controlada',
    className: 'border-[#cbd8ff] bg-[#f2f5ff] text-signal',
  },
  confirmation_required: {
    label: 'Confirmação necessária',
    className: 'border-[#f1d69e] bg-[#fff8e8] text-[#8a5a00]',
  },
}

export function CopilotConversation({
  messages,
  input,
  sending,
  onInputChange,
  onSend,
  onRetry,
}: CopilotConversationProps) {
  const [dismissedConfirmations, setDismissedConfirmations] = useState<Set<string>>(() => new Set())

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSend()
  }

  function dismissConfirmation(messageId: string) {
    setDismissedConfirmations((current) => {
      const next = new Set(current)
      next.add(messageId)
      return next
    })
  }

  return (
    <div className="page-card flex min-h-[550px] flex-col" aria-busy={sending}>
      <div className="mb-5 flex items-center justify-between border-b border-[#edf0f6] pb-4">
        <div>
          <p className="eyebrow">Conversa atual</p>

          <h2 className="font-display text-xl font-semibold">
            Como posso ajudar sua operação hoje?
          </h2>
        </div>

        <span className="text-xs text-muted">
          {sending ? 'Consultando...' : 'Contexto protegido'}
        </span>
      </div>

      <div className="mb-5 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {COPILOT_SUGGESTIONS.map(([title, description, prompt]) => (
          <button
            className="rounded-lg border border-line bg-[#fbfcff] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#8fa9ff] disabled:cursor-wait disabled:opacity-60"
            disabled={sending}
            key={title}
            type="button"
            onClick={() => void onSend(prompt)}
          >
            <strong className="block text-xs text-ink">{title}</strong>

            <small className="mt-1 block text-[11px] leading-relaxed text-muted">
              {description}
            </small>
          </button>
        ))}
      </div>

      <div
        className="grid flex-1 content-start gap-3 overflow-y-auto pr-1"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message) => {
          const statusPresentation = message.status ? STATUS_PRESENTATION[message.status] : null
          const confirmationDismissed = dismissedConfirmations.has(message.id)
          const confirmationAction = message.actions?.find((action) => action.requires_confirmation)
          const regularActions = message.actions?.filter((action) => !action.requires_confirmation)

          return (
            <div
              className={`max-w-[86%] rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${
                message.role === 'user'
                  ? 'justify-self-end bg-signal text-white'
                  : message.retryPrompt
                    ? 'justify-self-start border border-[#f0b9b9] bg-[#fff5f5] text-[#8b2525]'
                    : 'justify-self-start border border-line bg-white text-[#354064]'
              }`}
              key={message.id}
            >
              {statusPresentation ? (
                <span
                  className={`mb-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusPresentation.className}`}
                >
                  {statusPresentation.label}
                </span>
              ) : null}

              <p>{message.text}</p>

              {message.items && message.items.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {message.items.map((item) => (
                    <Link
                      className="rounded-lg border border-line bg-[#fbfcff] p-3 text-inherit no-underline transition hover:border-[#8fa9ff]"
                      key={item.id}
                      to={item.path}
                    >
                      <strong className="block text-xs text-ink">{item.title}</strong>

                      <small className="mt-1 block text-[11px] text-muted">
                        {item.description}
                      </small>
                    </Link>
                  ))}
                </div>
              ) : null}

              {regularActions && regularActions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {regularActions.map((action) => (
                    <Link
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#b9c8f8] bg-[#f4f6ff] px-3 py-2 text-xs font-bold text-signal no-underline hover:border-signal"
                      key={action.id}
                      to={action.path}
                    >
                      {action.label}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : null}

              {message.confirmation ? (
                confirmationDismissed ? (
                  <p className="mt-3 rounded-lg bg-[#f4f5f8] p-3 text-xs text-muted">
                    Ação cancelada. Nenhuma alteração foi realizada.
                  </p>
                ) : (
                  <div
                    className="mt-3 rounded-lg border border-[#f1d69e] bg-[#fffaf0] p-3"
                    role="group"
                    aria-label="Confirmação da ação"
                  >
                    <strong className="block text-xs text-ink">{message.confirmation.title}</strong>

                    <p className="mt-1 text-xs text-muted">{message.confirmation.description}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {confirmationAction ? (
                        <Link className="primary-button" to={confirmationAction.path}>
                          {message.confirmation.confirm_label}
                        </Link>
                      ) : (
                        <button className="primary-button" disabled type="button">
                          {message.confirmation.confirm_label}
                        </button>
                      )}

                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => dismissConfirmation(message.id)}
                      >
                        {message.confirmation.cancel_label}
                      </button>
                    </div>
                  </div>
                )
              ) : null}

              {message.retryPrompt ? (
                <button
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#e0a3a3] bg-white px-3 py-2 text-xs font-bold text-[#9f2f2f]"
                  disabled={sending}
                  type="button"
                  onClick={() => void onRetry(message.id, message.retryPrompt!)}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Tentar novamente
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <form
        className="mt-5 flex flex-col gap-2 border-t border-[#edf0f6] pt-4 sm:flex-row"
        onSubmit={submit}
      >
        <label className="sr-only" htmlFor="copilot-message">
          Mensagem para o Copiloto
        </label>

        <textarea
          id="copilot-message"
          className="min-h-12 flex-1 resize-y rounded-lg border border-[#cfd6e8] bg-white p-3 text-sm outline-none focus:border-signal focus:ring-4 focus:ring-[rgba(61,99,245,.12)] disabled:cursor-wait disabled:bg-[#f7f8fb]"
          disabled={sending}
          maxLength={500}
          placeholder="Pergunte algo sobre sua empresa..."
          rows={1}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
        />

        <button className="primary-button" disabled={sending || !input.trim()} type="submit">
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
