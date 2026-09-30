import { ArrowRight, FileText, ListChecks, MessageSquarePlus } from 'lucide-react'
import { Link } from 'react-router-dom'

type CopilotSidebarProps = {
  history: string[]
  onSelectHistory: (message: string) => void
  onClearHistory: () => void
}

export function CopilotSidebar({ history, onSelectHistory, onClearHistory }: CopilotSidebarProps) {
  return (
    <aside className="grid content-start gap-5">
      <section className="page-card">
        <p className="eyebrow">Escolha o caminho</p>

        <h2 className="font-display text-lg font-semibold">Ações da operação</h2>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          Propostas comerciais ficam em Orçamentos. Pedidos já confirmados ficam em Pedidos.
        </p>

        <div className="mt-5 grid gap-2.5">
          <Link
            className="flex items-center gap-3 rounded-lg border border-line p-3 text-xs font-bold text-[#354064] no-underline hover:border-[#9fb5ff] hover:text-signal"
            to="/orcamentos"
          >
            <FileText size={18} aria-hidden="true" />

            <span className="flex-1">
              Criar orçamento
              <small className="mt-1 block font-normal text-muted">
                Montar proposta para um cliente
              </small>
            </span>

            <ArrowRight size={15} aria-hidden="true" />
          </Link>

          <Link
            className="flex items-center gap-3 rounded-lg border border-line p-3 text-xs font-bold text-[#354064] no-underline hover:border-[#9fb5ff] hover:text-signal"
            to="/pedidos"
          >
            <ListChecks size={18} aria-hidden="true" />

            <span className="flex-1">
              Acompanhar pedidos
              <small className="mt-1 block font-normal text-muted">
                Consultar produção e status
              </small>
            </span>

            <ArrowRight size={15} aria-hidden="true" />
          </Link>

          <Link
            className="flex items-center gap-3 rounded-lg border border-line p-3 text-xs font-bold text-[#354064] no-underline hover:border-[#9fb5ff] hover:text-signal"
            to="/clientes"
          >
            <MessageSquarePlus size={18} aria-hidden="true" />

            <span className="flex-1">
              Gerenciar clientes
              <small className="mt-1 block font-normal text-muted">Usar o cadastro manual</small>
            </span>

            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="page-card">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Histórico</p>

          <button className="text-xs font-bold text-signal" type="button" onClick={onClearHistory}>
            Limpar
          </button>
        </div>

        {history.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Suas perguntas aparecerão aqui.</p>
        ) : (
          <div className="mt-2 grid gap-1.5">
            {history.map((item) => (
              <button
                className="truncate rounded-md px-2 py-2 text-left text-xs text-[#536080] hover:bg-[#f2f5ff]"
                key={item}
                type="button"
                title={item}
                onClick={() => onSelectHistory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}
