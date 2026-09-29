import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../contexts/SessionContext'
import type { Permission } from '../utils/permissions'

type PermissionGateProps = {
  permission: Permission
  children: ReactNode
}

export function PermissionGate({ permission, children }: PermissionGateProps) {
  const { can } = useSession()

  if (can(permission)) {
    return children
  }

  return (
    <main className="mx-auto grid min-h-[70vh] w-full max-w-[1180px] place-items-center p-7 md:p-16">
      <section
        className="w-full max-w-lg rounded-xl border border-line bg-white p-7 text-center shadow-[0_8px_24px_rgba(17,25,54,.04)]"
        aria-labelledby="access-denied-title"
      >
        <p className="eyebrow">Permissão necessária</p>

        <h1 className="mt-3 font-display text-3xl font-semibold" id="access-denied-title">
          Acesso restrito
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted">
          Seu perfil pode consultar e operar o sistema, mas não possui permissão para acessar esta
          configuração.
        </p>

        <Link className="primary-button mt-6" to="/dashboard">
          Voltar à visão geral
        </Link>
      </section>
    </main>
  )
}
