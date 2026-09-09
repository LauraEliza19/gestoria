import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
    Promise.all([apiFetch<Customer[]>('/api/customers'), apiFetch<Product[]>('/api/products')]).then(([customerList, productList]) => { setCustomers(customerList); setProducts(productList) }).catch(() => setStatus('Não foi possível carregar o contexto da empresa.'))
  }, [])

  function newConversation() { setMessages([welcome]); setInput(''); setProposal(null); setResult(null); setStatus('') }

  async function sendMessage(event?: FormEvent, messageOverride?: string) {
    event?.preventDefault()
    const text = (messageOverride ?? input).trim()
    if (!text) return
    const nextHistory = [text, ...history.filter((item) => item !== text)].slice(0, 8)
    const userMessage = { id: `user-${text}-${nextHistory.length}`, role: 'user' as const, text }
    setMessages((current) => [...current, userMessage])
    setHistory(nextHistory)
    sessionStorage.setItem('gestoria_copilot_history', JSON.stringify(nextHistory))
    setInput('')
    try {
      const response = await apiFetch<{ message: string }>('/api/copilot/chat', { method: 'POST', body: JSON.stringify({ message: text }) })
      setMessages((current) => [...current, { id: `assistant-${text}`, role: 'assistant', text: response.message }])
    } catch {
      setMessages((current) => [...current, { id: `unavailable-${text}`, role: 'assistant', text: 'A interface está pronta, mas a API de conversa ainda não foi configurada no backend. O fluxo seguro de pedidos continua disponível nesta tela.' }])
    }
  }

  async function prepareOrder(event: FormEvent) {
    event.preventDefault()
    if (!customerId || !productId || Number(quantity) <= 0) { setStatus('Selecione cliente, produto e quantidade válidos.'); return }
    try { setStatus(''); setProposal(await apiFetch<Proposal>('/api/orders/proposals', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ customer_id: customerId, items: [{ product_id: productId, quantity: Number(quantity) }] }) })) } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível preparar o pedido.') }
  }

  async function confirmOrder() {
    if (!proposal) return
    try { const order = await apiFetch<Order>(`/api/orders/proposals/${proposal.operation_id}/confirm`, { method: 'POST', body: JSON.stringify({ envelope: proposal.envelope }) }); setResult(order); setProposal(null); setMessages((current) => [...current, { id: `confirmed-${proposal.operation_id}`, role: 'assistant', text: `Pedido confirmado para ${order.customer_name}. Total: R$ ${Number(order.total_amount).toFixed(2).replace('.', ',')}.` }]) } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível confirmar o pedido.') }
  }

  async function cancelProposal() { if (!proposal) return; try { await apiFetch(`/api/orders/proposals/${proposal.operation_id}/cancel`, { method: 'POST' }); setProposal(null); setStatus('Proposta cancelada.') } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível cancelar a proposta.') } }

  return <div className="copilot-app"><aside className="copilot-sidebar"><Link className="copilot-brand" to="/dashboard"><span className="brand-mark"><span /></span>Gestor<span>IA</span></Link><Link className="back-dashboard" to="/dashboard">← Voltar ao dashboard</Link><button className="new-conversation-button" onClick={newConversation}>+ Nova conversa</button><div className="conversation-history"><div className="conversation-history-label">Conversas recentes</div>{history.length === 0 && <div className="conversation-history-empty">Suas conversas aparecerão aqui.</div>}{history.map((item) => <button key={item} onClick={() => setInput(item)}>{item}</button>)}</div><div className="copilot-company"><span className="company-avatar">G</span><div><strong>Sua empresa</strong><span>Contexto protegido</span></div></div></aside><main className="copilot-workspace"><header className="copilot-header"><div><span className="copilot-eyebrow">Assistente empresarial</span><h1>Copiloto GestorIA</h1></div><div className="copilot-context-status"><span /> Contexto da empresa ativo</div></header><section className="copilot-conversation"><div className="copilot-welcome"><div className="copilot-welcome-mark">✦</div><h2>Como posso ajudar sua operação hoje?</h2><p>Consulte informações, encontre prioridades e execute ações com confirmação e segurança.</p><div className="copilot-suggestions">{suggestions.map(([title, description, prompt]) => <button key={title} onClick={() => void sendMessage(undefined, prompt)}><strong>{title}</strong><small>{description}</small></button>)}</div></div><div className="copilot-messages">{messages.map((message) => <div className={`copilot-message ${message.role}`} key={message.id}>{message.text}</div>)}</div></section><section className="copilot-action"><div><p className="eyebrow">Ação segura</p><h2>Preparar pedido</h2></div><form onSubmit={prepareOrder}><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><button className="primary-button" type="submit">Preparar</button></form>{proposal && <div className="proposal-inline"><code>{JSON.stringify(proposal.envelope)}</code><button className="primary-button" onClick={() => void confirmOrder()}>Confirmar</button><button className="secondary-button" onClick={() => void cancelProposal()}>Cancelar</button></div>}{result && <p className="success-copy">Pedido criado para {result.customer_name}.</p>}{status && <p className="form-status">{status}</p>}</section><form className="copilot-composer" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={1} placeholder="Pergunte algo sobre sua empresa..." /><button className="primary-button" type="submit">Enviar</button></form><p className="copilot-disclaimer">O Copiloto solicita confirmação antes de realizar alterações.</p></main></div>
}
