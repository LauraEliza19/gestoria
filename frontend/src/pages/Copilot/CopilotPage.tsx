import { FileText, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CopilotConversation } from './CopilotConversation'
import { CopilotSidebar } from './CopilotSidebar'
import { useCopilot } from './useCopilot'

export function CopilotPage() {
  const {
    messages,
    input,
    setInput,
    history,
    sending,
    newConversation,
    clearHistory,
    sendMessage,
  } = useCopilot()

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Assistente empresarial</p>

          <h1>Copiloto GestorIA</h1>

          <p>Consulte informações e escolha quando usar o Copiloto ou os fluxos manuais.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link className="secondary-button" to="/orcamentos">
            <FileText size={16} aria-hidden="true" />
            Criar orçamento
          </Link>

          <button
            className="secondary-button"
            disabled={sending}
            type="button"
            onClick={newConversation}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Nova conversa
          </button>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <CopilotConversation
          input={input}
          messages={messages}
          sending={sending}
          onInputChange={setInput}
          onSend={sendMessage}
        />

        <CopilotSidebar
          history={history}
          onClearHistory={clearHistory}
          onSelectHistory={setInput}
        />
      </section>
    </div>
  )
}
