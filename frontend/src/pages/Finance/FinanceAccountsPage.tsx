import { ArrowLeft, CheckCircle2, Paperclip, Plus, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { FormExit, SaveButton } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormSuccess, useSaveAction } from '../../components/forms/useFormState'
import { useSession } from '../../contexts/SessionContext'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  getFinanceCategories,
  getFinanceEntries,
  settleFinanceEntry,
  uploadFinanceAttachment,
  type FinanceCategory,
  type FinanceEntry,
} from '../../services/finance.service'
import { getErrorMessage } from '../../utils/errors'

function money(value: string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function date(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
}

function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const statusLabels = {
  pending: 'Pendente',
  paid: 'Baixado',
  cancelled: 'Cancelado',
} as const

export function FinanceAccountsPage() {
  const { can } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const receivables = searchParams.get('tipo') === 'receber'
  const entryType = receivables ? 'income' : 'expense'
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const [settling, setSettling] = useState<FinanceEntry | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [currentEntries, currentCategories] = await Promise.all([
        getFinanceEntries({ entry_type: entryType, sort: 'due_date' }),
        getFinanceCategories(),
      ])
      setEntries(currentEntries)
      setCategories(currentCategories)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível carregar as contas.'))
    } finally {
      setLoading(false)
    }
  }, [entryType])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts, requestVersion])

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <Link
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-signal"
            to="/financeiro"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para o Financeiro
          </Link>
          <p className="eyebrow">Controle financeiro</p>
          <h1>Contas a pagar e receber</h1>
          <p>Títulos ordenados pelo vencimento, com baixa, anexos e histórico de auditoria.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            className="secondary-button gap-2"
            type="button"
            onClick={() => setRequestVersion((current) => current + 1)}
            disabled={loading}
          >
            <RefreshCw size={17} aria-hidden="true" />
            Atualizar
          </button>
          {can('finance:manage') && (
            <Link className="primary-button gap-2" to="/financeiro/lancamentos/novo">
              <Plus size={17} aria-hidden="true" />
              Novo lançamento
            </Link>
          )}
        </div>
      </header>

      <div className="fiscal-tabs" role="tablist" aria-label="Tipo de conta">
        <button
          type="button"
          role="tab"
          aria-selected={!receivables}
          className={receivables ? '' : 'active'}
          onClick={() => setSearchParams({})}
        >
          A pagar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={receivables}
          className={receivables ? 'active' : ''}
          onClick={() => setSearchParams({ tipo: 'receber' })}
        >
          A receber
        </button>
      </div>

      <section className="page-card min-w-0">
        {loading ? (
          <LoadingState message="Carregando contas..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setRequestVersion((current) => current + 1)} />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nenhuma conta encontrada"
            description="Cadastre um lançamento com vencimento para acompanhá-lo aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="data-table finance-accounts-table">
              <div className="data-table-row data-table-head">
                <span>Título</span>
                <span>Categoria</span>
                <span>Vencimento</span>
                <span>Situação</span>
                <span className="text-right">Valor</span>
                <span>Ações</span>
              </div>
              {entries.map((entry) => (
                <div className="data-table-row" key={entry.id}>
                  <span>
                    <strong>{entry.description}</strong>
                  </span>
                  <span>{categoryNames.get(entry.category_id) || 'Categoria não encontrada'}</span>
                  <span>{date(entry.due_date)}</span>
                  <span>
                    <span
                      className={`fiscal-status-badge ${
                        entry.status === 'paid'
                          ? 'fiscal-status-success'
                          : entry.status === 'cancelled'
                            ? 'fiscal-status-neutral'
                            : entry.is_overdue
                              ? 'fiscal-status-danger'
                              : 'fiscal-status-warning'
                      }`}
                    >
                      {entry.is_overdue ? 'Vencido' : statusLabels[entry.status]}
                    </span>
                  </span>
                  <strong className="text-right">{money(entry.amount)}</strong>
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {can('finance:manage') && entry.status === 'pending' && (
                      <button
                        className="text-sm font-bold text-[#268267]"
                        type="button"
                        onClick={() => setSettling(entry)}
                      >
                        Baixar
                      </button>
                    )}
                    {can('finance:manage') && (
                      <Link
                        className="text-sm font-bold text-signal"
                        to={`/financeiro/lancamentos/${entry.id}/editar`}
                      >
                        Abrir
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {settling && (
        <SettleModal
          entry={settling}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null)
            setRequestVersion((current) => current + 1)
          }}
        />
      )}
    </main>
  )
}

function SettleModal({
  entry,
  onClose,
  onDone,
}: {
  entry: FinanceEntry
  onClose: () => void
  onDone: () => void
}) {
  const today = todayISO()
  const [initialPaidDate] = useState(today)
  const [paidDate, setPaidDate] = useState(initialPaidDate)
  const [files, setFiles] = useState<File[]>([])
  const [settled, setSettled] = useState(false)
  const { busy: saving, run: save } = useSaveAction()
  const announceSuccess = useFormSuccess()
  const [error, setError] = useState('')

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files || [])
    event.target.value = ''
    const tooLarge = chosen.find((file) => file.size > ATTACHMENT_MAX_BYTES)
    if (tooLarge) {
      setError(`${tooLarge.name}: o arquivo deve ter no máximo 5 MB.`)
      return
    }
    setError('')
    setFiles((current) => [...current, ...chosen])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await save(async () => {
      setError('')
      try {
        if (!settled) {
          await settleFinanceEntry(entry.id, {
            expected_version: entry.version,
            // Hoje: o servidor registra o horário exato. Outra data: meio-dia local.
            paid_at: paidDate === today ? null : new Date(`${paidDate}T12:00:00`).toISOString(),
          })
          setSettled(true)
        }
      } catch (requestError) {
        setError(getErrorMessage(requestError, 'Não foi possível registrar a baixa.'))
        return
      }
      try {
        for (const file of files) {
          await uploadFinanceAttachment(entry.id, file)
          setFiles((current) => current.slice(1))
        }
        announceSuccess('Baixa registrada.')
        onDone()
      } catch (requestError) {
        setError(
          `Baixa registrada, mas o comprovante não foi enviado: ${getErrorMessage(requestError)}`,
        )
      }
    })
  }

  const close = settled ? onDone : onClose

  return (
    <div className="fiscal-modal-backdrop" role="presentation">
      <div
        className="fiscal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-settle-title"
      >
        <header className="fiscal-modal-header">
          <span className="text-sm font-semibold text-muted">Contas a pagar e receber</span>
          <button
            className="detail-close"
            type="button"
            aria-label="Fechar janela"
            disabled={saving}
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <form
          className="fiscal-modal-body"
          aria-busy={saving}
          onInvalidCapture={() => setError('')}
          onSubmit={handleSubmit}
        >
          <FormHeader
            module="Financeiro"
            title="Registrar baixa"
            description="Informe a data da baixa e inclua um comprovante, se houver."
            mode="edit"
            heading="h2"
            headingId="finance-settle-title"
            dirty={(!settled && paidDate !== initialPaidDate) || files.length > 0}
            back={{ onClick: close, label: 'Voltar para contas a pagar e receber' }}
            blocked={saving}
          />
          <p className="text-sm text-muted">
            {entry.description} · {money(entry.amount)} · vencimento {date(entry.due_date)}
          </p>
          <label className="form-label">
            <span>
              Data da baixa
              <RequiredMark />
            </span>
            <input
              className="form-input"
              type="date"
              value={paidDate}
              disabled={saving || settled}
              required
              onChange={(event) => setPaidDate(event.target.value)}
            />
          </label>
          <div className="form-label">
            Comprovante (opcional)
            <label className="secondary-button w-fit cursor-pointer gap-2">
              <Paperclip size={17} aria-hidden="true" />
              Escolher arquivo
              <input
                className="sr-only"
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                disabled={saving || settled}
                onChange={handleFiles}
              />
            </label>
            {files.length > 0 && (
              <ul className="text-xs font-normal text-muted">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>{file.name}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-sm font-semibold text-[#216146]" role="status">
            {settled && !saving ? 'Baixa registrada.' : ''}
          </p>
          {error && (
            <p className="text-sm text-[#d84f62]" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <FormExit
              onClick={close}
              blocked={saving}
              dirty={(!settled && paidDate !== initialPaidDate) || files.length > 0}
            >
              {settled ? 'Fechar' : 'Cancelar'}
            </FormExit>
            <SaveButton saving={saving} icon={<CheckCircle2 size={17} aria-hidden="true" />}>
              {settled ? 'Enviar comprovante' : 'Confirmar baixa'}
            </SaveButton>
          </div>
        </form>
      </div>
    </div>
  )
}
