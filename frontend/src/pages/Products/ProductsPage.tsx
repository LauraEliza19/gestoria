import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useSession } from '../../contexts/SessionContext'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'

type Product = {
  id: string
  name: string
  price: string
  category: string
  stock_quantity: string
  status?: string
}

export function ProductsPage() {
  const { can } = useSession()

  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const list = await apiFetch<Product[]>('/api/products')
      setProducts(list)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Não foi possível carregar os produtos.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  async function removeProduct(product: Product) {
    if (!window.confirm(`Excluir o produto "${product.name}"?`)) {
      return
    }

    setDeletingId(product.id)
    setActionError('')

    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: 'DELETE',
      })

      setProducts((current) => current.filter((item) => item.id !== product.id))
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível excluir o produto.'))
    } finally {
      setDeletingId(null)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()

  const filtered = products.filter((product) =>
    `${product.name} ${product.category}`.toLowerCase().includes(normalizedSearch),
  )

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catálogo manual</p>
          <h1>Produtos</h1>
          <p>Controle seu catálogo, preços e estoque.</p>
        </div>

        <Link className="primary-button" to="/produtos/novo">
          Novo produto
        </Link>
      </header>

      <section className="page-card">
        <input
          className="search-input"
          aria-label="Buscar produtos"
          placeholder="Buscar por nome ou categoria"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {actionError && (
          <p className="error-banner mb-5" role="alert">
            {actionError}
          </p>
        )}

        {loading && <LoadingState message="Carregando produtos..." />}

        {!loading && loadError && (
          <ErrorState message={loadError} onRetry={() => void loadProducts()} />
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <EmptyState
            title="Nenhum produto encontrado"
            description={
              search
                ? 'Tente buscar usando outro nome ou categoria.'
                : 'Cadastre o primeiro produto para iniciar seu catálogo.'
            }
          />
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="data-table products-table">
            <div className="data-table-row data-table-head">
              <span>Produto</span>
              <span>Categoria</span>
              <span>Preço</span>
              <span>Estoque</span>
              <span>Ações</span>
            </div>

            {filtered.map((product) => (
              <div className="data-table-row" key={product.id}>
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.status || 'Ativo'}</small>
                </span>

                <span>{product.category}</span>

                <span>R$ {Number(product.price).toFixed(2).replace('.', ',')}</span>

                <span>{product.stock_quantity}</span>

                <span className="row-actions">
                  <Link to={`/produtos/novo?id=${product.id}`}>Editar</Link>

                  {can('product:delete') && (
                    <button
                      type="button"
                      disabled={deletingId === product.id}
                      onClick={() => void removeProduct(product)}
                    >
                      {deletingId === product.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
