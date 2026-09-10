import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../services/api'

type Product = { id: string; name: string; price: string; category: string; stock_quantity: string; status?: string }

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Carregando produtos...')

  useEffect(() => {
    apiFetch<Product[]>('/api/products').then((list) => { setProducts(list); setStatus('') }).catch((error) => setStatus(error instanceof Error ? error.message : 'Não foi possível carregar os produtos.'))
  }, [])

  async function removeProduct(product: Product) {
    if (!window.confirm(`Excluir o produto "${product.name}"?`)) return
    try { await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' }); setProducts((current) => current.filter((item) => item.id !== product.id)) } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível excluir o produto.') }
  }

  const filtered = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">Catálogo</p><h1>Produtos</h1><p>Controle seu catálogo, preços e estoque.</p></div><Link className="primary-button" to="/produtos/novo">Novo produto</Link></header><section className="page-card"><input className="search-input" placeholder="Buscar por nome ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} />{status && <p className="table-status">{status}</p>}{!status && <div className="data-table"><div className="data-table-row data-table-head"><span>Produto</span><span>Categoria</span><span>Preço</span><span>Estoque</span><span>Ações</span></div>{filtered.map((product) => <div className="data-table-row" key={product.id}><span><strong>{product.name}</strong><small>{product.status || 'Ativo'}</small></span><span>{product.category}</span><span>R$ {Number(product.price).toFixed(2).replace('.', ',')}</span><span>{product.stock_quantity}</span><span className="row-actions"><Link to={`/produtos/novo?id=${product.id}`}>Editar</Link><button onClick={() => void removeProduct(product)}>Excluir</button></span></div>)}{filtered.length === 0 && <p className="table-status">Nenhum produto encontrado.</p>}</div>}</section></div>
}
