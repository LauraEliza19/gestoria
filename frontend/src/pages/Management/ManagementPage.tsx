import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useManagement } from './useManagement'

export function ManagementPage() {
  const { overview, employees, costCenters, loading, error, reload } = useManagement()

  const recentEmployees = employees.slice(0, 5)
  const activeCostCenters = costCenters.filter((costCenter) => costCenter.is_active).slice(0, 5)

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando a Gestão Interna..." />
      </main>
    )
  }

  if (error) {
    return (
      <main className="page-wrap">
        <ErrorState message={error} onRetry={reload} />
      </main>
    )
  }

  if (!overview) {
    return (
      <main className="page-wrap">
        <EmptyState
          title="Resumo indisponível"
          description="Não foi possível encontrar os indicadores da Gestão Interna."
        />
      </main>
    )
  }

  const metrics = [
    {
      label: 'Funcionários ativos',
      value: overview.active_employees,
      description: `${overview.total_employees} cadastrados no total`,
      icon: Users,
      tone: 'bg-[#eef2ff] text-signal',
    },
    {
      label: 'Vínculos ativos',
      value: overview.active_employments,
      description: 'Relações profissionais em andamento',
      icon: BriefcaseBusiness,
      tone: 'bg-[#effaf6] text-[#268267]',
    },
    {
      label: 'Pessoas afastadas',
      value: overview.employees_on_leave,
      description: 'Vínculos temporariamente afastados',
      icon: CalendarDays,
      tone: 'bg-[#fff8eb] text-[#c77716]',
    },
    {
      label: 'Centros de custo',
      value: overview.active_cost_centers,
      description: 'Áreas ativas para organização',
      icon: Building2,
      tone: 'bg-[#f8f2ff] text-[#8057b2]',
    },
  ]

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Gestão interna</p>
          <h1>Central do empresário</h1>
          <p>Acompanhe sua equipe, vínculos e estrutura interna em um só lugar.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link className="secondary-button" to="/gestao/centros-de-custo">
            Centros de custo
          </Link>

          <Link className="primary-button gap-2" to="/gestao/funcionarios/novo">
            <UserPlus size={17} aria-hidden="true" />
            Cadastrar funcionário
          </Link>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores da Gestão Interna"
      >
        {metrics.map(({ label, value, description, icon: Icon, tone }) => (
          <article className="page-card" key={label}>
            <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
              <Icon size={20} aria-hidden="true" />
            </div>

            <span className="text-sm text-muted">{label}</span>
            <strong className="mt-2 block font-display text-3xl font-semibold">{value}</strong>
            <small className="mt-2 block text-xs leading-5 text-[#8991aa]">{description}</small>
          </article>
        ))}
      </section>

      <section className="mt-6 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <article className="page-card min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Equipe</p>
              <h2 className="font-display text-xl font-semibold">Funcionários recentes</h2>
            </div>

            <Link
              className="inline-flex items-center gap-2 text-sm font-bold text-signal"
              to="/gestao/funcionarios"
            >
              Ver equipe
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {recentEmployees.length === 0 ? (
            <EmptyState
              title="Nenhum funcionário cadastrado"
              description="Cadastre a primeira pessoa para começar a organizar sua equipe."
            />
          ) : (
            <ul className="divide-y divide-[#edf0f6]">
              {recentEmployees.map((employee) => (
                <li
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  key={employee.id}
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{employee.full_name}</strong>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {employee.email || employee.phone || 'Contato não informado'}
                    </span>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      employee.is_active ? 'bg-[#effaf6] text-[#268267]' : 'bg-[#f1f3f8] text-muted'
                    }`}
                  >
                    {employee.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="page-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Estrutura</p>
              <h2 className="font-display text-xl font-semibold">Centros de custo</h2>
            </div>

            <Link
              className="inline-flex items-center gap-2 text-sm font-bold text-signal"
              to="/gestao/centros-de-custo"
            >
              Gerenciar
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {activeCostCenters.length === 0 ? (
            <EmptyState
              title="Nenhum centro de custo ativo"
              description="Organize as áreas da empresa para preparar as integrações financeiras."
            />
          ) : (
            <ul className="space-y-3">
              {activeCostCenters.map((costCenter) => (
                <li
                  className="flex items-center gap-3 rounded-lg border border-line p-4"
                  key={costCenter.id}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f2f5ff] font-mono text-xs font-bold text-signal">
                    {costCenter.code.slice(0, 3)}
                  </div>

                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{costCenter.name}</strong>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {costCenter.description || 'Sem descrição'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-dashed border-[#cbd4e8] bg-white/60 p-5">
          <CircleDollarSign className="text-signal" size={22} aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-semibold">Integração financeira</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Receitas, despesas e saldo serão integrados ao módulo financeiro, sem duplicar regras
            contábeis.
          </p>
        </article>

        <article className="rounded-xl border border-dashed border-[#cbd4e8] bg-white/60 p-5">
          <CalendarDays className="text-signal" size={22} aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-semibold">Agenda empresarial</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Compromissos e lembretes fazem parte das próximas evoluções da Gestão Interna.
          </p>
        </article>
      </section>
    </main>
  )
}
