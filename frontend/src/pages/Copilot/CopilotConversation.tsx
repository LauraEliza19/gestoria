import type { FormEvent } from 'react'
import { COPILOT_SUGGESTIONS } from './copilotData'
import type { CopilotMessage } from './copilotTypes'

type CopilotConversationProps = {
  messages: CopilotMessage[]
  input: string
  sending: boolean
  onInputChange: (value: string) => void
  onSend: (prompt?: string) => Promise<void>
}

export function CopilotConversation({
  messages,
  input,
  sending,
  onInputChange,
  onSend,
}: CopilotConversationProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSend()
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

        <span className="text-xs text-muted">{sending ? 'Consultando...' : 'Contexto ativo'}</span>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        {messages.map((message) => (
          <div
            className={`max-w-[86%] rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${
              message.role === 'user'
                ? 'justify-self-end bg-signal text-white'
                : 'justify-self-start border border-line bg-white text-[#354064]'
            }`}
            key={message.id}
          >
            {message.text}
          </div>
        ))}
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
          className="min-h-12 flex-1 resize-y rounded-lg border border-[#cfd6e8] bg-white p-3 text-sm outline-none focus:border-signal focus:ring-4 focus:ring-[rgba(61,99,245,.12)]"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          rows={1}
          placeholder="Pergunte algo sobre sua empresa..."
        />

        <button className="primary-button" disabled={sending} type="submit">
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
