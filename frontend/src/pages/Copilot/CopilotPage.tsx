import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../../services/api'

type Message = { id: string; role: 'user' | 'assistant'; text: string }
type Customer = { id: string; name: string }
type Product = { id: string; name: string; price: string }
type Proposal = { operation_id: string; envelope: Record<string, unknown> }
type Order = { customer_name: string; total_amount: string }

const suggestions = [
  ['Prioridades do dia', 'Veja pedidos, estoque e orçamentos importantes.', 'O que precisa da minha atenção hoje?'],
  ['Estoque crítico', 'Identifique produtos que precisam de reposição.', 'Quais produtos estão com estoque crítico?'],
  ['Pedidos em produção', 'Acompanhe o andamento da operação.', 'Quais pedidos estão em produção?'],
  ['Orçamentos', 'Encontre propostas próximas do vencimento.', 'Quais orçamentos precisam de acompanhamento?'],
]

const welcome: Message = { id: 'welcome', role: 'assistant', text: 'Olá! Sou a IA da GestorIA. Pergunte sobre sua empresa, prioridades, estoque, pedidos ou orçamentos. Para executar alterações, vou pedir sua confirmação.' }

export function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('gestoria_copilot_history')
    return saved ? JSON.parse(saved) as string[] : []
  })
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [result, setResult] = useState<Order | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([apiFetch<Customer[]>('/api/customers'), apiFetch<Product[]>('/api/products')])
      .then(([customerList, productList]) => { setCustomers(customerList); setProducts(productList) })
      .catch(() => setStatus('Não foi possível carregar o contexto da empresa.'))
  }, [])

  function newConversation() {
    setMessages([welcome]); setInput(''); setProposal(null); setResult(null); setStatus('')
  }

  async function sendMessage(event?: FormEvent, messageOverride?: string) {
    event?.preventDefault()
    const text = (messageOverride ?? input).trim()
    if (!text) return
    const nextHistory = [text, ...history.filter((item) => item !== text)].slice(0, 8)
    setMessages((current) => [...current, { id: `user-${text}-${nextHistory.length}`, role: 'user', text }])
    setHistory(nextHistory); sessionStorage.setItem('gestoria_copilot_history', JSON.stringify(nextHistory)); setInput('')
    try {
      const response = await apiFetch<{ message: string }>('/api/copilot/chat', { method: 'POST', body: JSON.stringify({ message: text }) })
      setMessages((current) => [...current, { id: `assistant-${text}`, role: 'assistant', text: response.message }])
    } catch {
      setMessages((current) => [...current, { id: `unavailable-${text}`, role: 'assistant', text: 'A API de conversa ainda não foi configurada. O fluxo seguro de pedidos continua disponível abaixo.' }])
    }
  }

  async function prepareOrder(event: FormEvent) {
    event.preventDefault()
    if (!customerId || !productId || Number(quantity) <= 0) { setStatus('Selecione cliente, produto e quantidade válidos.'); return }
    try {
      setStatus('')
      setProposal(await apiFetch<Proposal>('/api/orders/proposals', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ customer_id: customerId, items: [{ product_id: productId, quantity: Number(quantity) }] }) }))
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível preparar o pedido.') }
  }

  async function confirmOrder() {
    if (!proposal) return
    try {
      const order = await apiFetch<Order>(`/api/orders/proposals/${proposal.operation_id}/confirm`, { method: 'POST', body: JSON.stringify({ envelope: proposal.envelope }) })
      setResult(order); setProposal(null); setMessages((current) => [...current, { id: `confirmed-${proposal.operation_id}`, role: 'assistant', text: `Pedido confirmado para ${order.customer_name}. Total: R$ ${Number(order.total_amount).toFixed(2).replace('.', ',')}.` }])
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível confirmar o pedido.') }
  }

  async function cancelProposal() {
    if (!proposal) return
    try { await apiFetch(`/api/orders/proposals/${proposal.operation_id}/cancel`, { method: 'POST' }); setProposal(null); setStatus('Proposta cancelada.') } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível cancelar a proposta.') }
  }

  return <div className="page-wrap">
    <header className="page-header">
      <div><p className="eyebrow">Assistente empresarial</p><h1>Copiloto GestorIA</h1><p>Consulte informações e execute ações com confirmação e segurança.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#bfe8d8] bg-[#effbf6] px-3 py-2 text-xs font-semibold text-[#32866a]">● Contexto ativo</span><button className="secondary-button" onClick={newConversation}>Nova conversa</button></div>
    </header>

    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="page-card flex min-h-[520px] flex-col">
        <div className="mb-5 flex items-center justify-between border-b border-[#edf0f6] pb-4"><div><p className="eyebrow">Conversa atual</p><h2 className="font-display text-xl font-semibold">Como posso ajudar sua operação hoje?</h2></div><span className="text-xs text-muted">{messages.length - 1} mensagem(ns)</span></div>
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{suggestions.map(([title, description, prompt]) => <button className="rounded-lg border border-line bg-[#fbfcff] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#8fa9ff]" key={title} onClick={() => void sendMessage(undefined, prompt)}><strong className="block text-xs text-ink">{title}</strong><small className="mt-1 block text-[11px] leading-relaxed text-muted">{description}</small></button>)}</div>
        <div className="grid flex-1 content-start gap-3 overflow-y-auto pr-1">{messages.map((message) => <div className={`max-w-[86%] rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${message.role === 'user' ? 'justify-self-end bg-signal text-white' : 'justify-self-start border border-line bg-white text-[#354064]'}`} key={message.id}>{message.text}</div>)}</div>
        <form className="mt-5 flex flex-col gap-2 border-t border-[#edf0f6] pt-4 sm:flex-row" onSubmit={sendMessage}><textarea className="min-h-12 flex-1 resize-y rounded-lg border border-[#cfd6e8] bg-white p-3 text-sm outline-none focus:border-signal focus:ring-4 focus:ring-[rgba(61,99,245,.12)]" value={input} onChange={(event) => setInput(event.target.value)} rows={1} placeholder="Pergunte algo sobre sua empresa..." /><button className="primary-button" type="submit">Enviar</button></form>
      </div>

      <aside className="grid content-start gap-5">
        <section className="page-card"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Ação segura</p><h2 className="font-display text-lg font-semibold">Preparar pedido</h2></div><span className="text-xs text-muted">Confirmação obrigatória</span></div><form className="grid gap-3" onSubmit={prepareOrder}><label className="grid gap-1.5 text-xs font-bold text-[#354064]">Cliente<select className="rounded-lg border border-[#dde2f0] bg-white p-2.5 text-sm" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Selecione</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label className="grid gap-1.5 text-xs font-bold text-[#354064]">Produto<select className="rounded-lg border border-[#dde2f0] bg-white p-2.5 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="grid gap-1.5 text-xs font-bold text-[#354064]">Quantidade<input className="rounded-lg border border-[#dde2f0] p-2.5 text-sm" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><button className="primary-button w-full" type="submit">Preparar proposta</button></form>{proposal && <div className="mt-4 grid gap-2 border-t border-[#edf0f6] pt-4"><code className="max-h-24 overflow-auto rounded-md bg-[#111936] p-2 text-[10px] text-[#dce4ff]">{JSON.stringify(proposal.envelope)}</code><button className="primary-button" onClick={() => void confirmOrder()}>Confirmar pedido</button><button className="secondary-button" onClick={() => void cancelProposal()}>Cancelar proposta</button></div>}{result && <p className="mt-3 text-xs text-[#32866a]">Pedido criado para {result.customer_name}.</p>}{status && <p className="form-status mt-3">{status}</p>}</section>
        <section className="page-card"><div className="mb-3 flex items-center justify-between"><p className="eyebrow">Histórico</p><button className="text-xs font-bold text-signal" onClick={newConversation}>Limpar</button></div>{history.length === 0 ? <p className="text-xs text-muted">Suas conversas aparecerão aqui.</p> : <div className="grid gap-1.5">{history.map((item) => <button className="truncate rounded-md px-2 py-2 text-left text-xs text-[#536080] hover:bg-[#f2f5ff]" key={item} onClick={() => setInput(item)}>{item}</button>)}</div>}</section>
      </aside>
    </section>
  </div>
}
