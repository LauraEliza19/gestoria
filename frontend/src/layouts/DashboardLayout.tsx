import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  ChefHat,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { clearSession } from '../services/session'
import { useSession } from '../contexts/SessionContext'
import logoGestoria from '../assets/logo-gestoria-topo.png'

const navigationGroups = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    links: [
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/produtos', label: 'Produtos', icon: Package },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    links: [
      { to: '/orcamentos', label: 'Orçamentos', icon: FileText },
      { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
    ],
  },
  {
    id: 'operacao',
    label: 'Operação',
    links: [{ to: '/modo-fabrica', label: 'Produção', icon: ChefHat }],
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    links: [{ to: '/notas-fiscais', label: 'Notas fiscais', icon: ReceiptText }],
  },
]

const buttonClass =
  'flex min-h-11 w-full items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fb4ff] lg:w-auto'

const dropdownClass =
  'mt-2 space-y-1 rounded-xl border border-white/10 bg-[#192443] p-2 shadow-lg lg:absolute lg:left-0 lg:top-full lg:z-50 lg:min-w-56'

function TopNavigation() {
  const { can } = useSession()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const headerRef = useRef<HTMLElement>(null)

  function closeNavigation() {
    setOpenGroup(null)
    setMobileOpen(false)
  }

  function toggleGroup(id: string) {
    setOpenGroup((current) => (current === id ? null : id))
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setOpenGroup(null)
        setMobileOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      if (openGroup) {
        headerRef.current
          ?.querySelector<HTMLButtonElement>(`[data-navigation-group="${openGroup}"]`)
          ?.focus()

        setOpenGroup(null)
      } else if (mobileOpen) {
        headerRef.current?.querySelector<HTMLButtonElement>('#navigation-toggle')?.focus()

        setMobileOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openGroup, mobileOpen])

  function topLinkClass(isActive: boolean) {
    return `${buttonClass} ${
      isActive ? 'bg-white/10 text-white' : 'text-[#c4cde8] hover:bg-white/10 hover:text-white'
    }`
  }

  return (
    <header
      ref={headerRef}
      className="relative z-30 border-b border-white/10 bg-[#111936] text-white shadow-sm"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeNavigation()
        }
      }}
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
        <NavLink
          to="/dashboard"
          aria-label="GestorIA — Visão geral"
          onClick={closeNavigation}
          className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fb4ff]"
        >
          <div className="relative h-[52px] w-[56px] overflow-hidden">
            <img
              src={logoGestoria}
              alt=""
              className="absolute left-[-69px] top-[-28px] h-auto w-[200px] max-w-none"
              draggable={false}
            />
          </div>
        </NavLink>

        <button
          id="navigation-toggle"
          type="button"
          aria-label={mobileOpen ? 'Fechar navegação' : 'Abrir navegação'}
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 hover:bg-white/10 lg:hidden"
          onClick={() => {
            setMobileOpen((current) => !current)
            setOpenGroup(null)
          }}
        >
          {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>

        <nav
          id="main-navigation"
          aria-label="Navegação principal"
          className={`${
            mobileOpen ? 'flex' : 'hidden'
          } w-full flex-col gap-2 border-t border-white/10 pt-3 lg:flex lg:w-auto lg:flex-1 lg:flex-row lg:items-center lg:gap-1 lg:border-0 lg:pt-0`}
        >
          <NavLink
            to="/dashboard"
            end
            onClick={closeNavigation}
            className={({ isActive }) => topLinkClass(isActive)}
          >
            <LayoutDashboard size={17} aria-hidden="true" />
            Visão geral
          </NavLink>

          {navigationGroups.map((group) => {
            const isActive = group.links.some(
              (link) => pathname === link.to || pathname.startsWith(`${link.to}/`),
            )
            const isOpen = openGroup === group.id

            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  data-navigation-group={group.id}
                  aria-expanded={isOpen}
                  aria-controls={`navigation-${group.id}`}
                  className={topLinkClass(isActive)}
                  onClick={() => toggleGroup(group.id)}
                >
                  {group.label}
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <div id={`navigation-${group.id}`} hidden={!isOpen} className={dropdownClass}>
                  {group.links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={closeNavigation}
                      className={({ isActive: linkActive }) =>
                        `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          linkActive
                            ? 'bg-[#3d63f5] text-white'
                            : 'text-[#dce4ff] hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon size={18} aria-hidden="true" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}

          <NavLink
            to="/copiloto"
            onClick={closeNavigation}
            className={({ isActive }) => topLinkClass(isActive)}
          >
            <Sparkles size={17} aria-hidden="true" />
            Copiloto
          </NavLink>

          <div className="relative lg:ml-auto">
            <button
              type="button"
              data-navigation-group="conta"
              aria-expanded={openGroup === 'conta'}
              aria-controls="navigation-conta"
              className={topLinkClass(pathname.startsWith('/empresa/'))}
              onClick={() => toggleGroup('conta')}
            >
              <UserRound size={17} aria-hidden="true" />
              Conta
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={`ml-auto transition-transform ${
                  openGroup === 'conta' ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div
              id="navigation-conta"
              hidden={openGroup !== 'conta'}
              className={`${dropdownClass} lg:left-auto lg:right-0`}
            >
              {can('organization:update') && (
                <NavLink
                  to="/empresa/editar"
                  onClick={closeNavigation}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                      isActive ? 'bg-[#3d63f5] text-white' : 'text-[#dce4ff] hover:bg-white/10'
                    }`
                  }
                >
                  <Building2 size={18} aria-hidden="true" />
                  Empresa
                </NavLink>
              )}

              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#dce4ff] hover:bg-white/10"
                onClick={() => {
                  clearSession()
                  window.location.href = '/login'
                }}
              >
                <LogOut size={18} aria-hidden="true" />
                Sair
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}

export function DashboardLayout() {
  const location = useLocation()

  return (
    <div className="app-shell min-h-screen bg-paper text-ink">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-[200%] rounded-lg border border-line bg-white px-4 py-3 font-bold text-signal shadow-lg transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Pular para o conteúdo principal
      </a>

      <TopNavigation key={location.key} />

      <main className="app-content min-w-0" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
