import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UNSAVED_FORM_MESSAGE } from './useFormState'

type SavingFormProps = ComponentPropsWithoutRef<'form'> & { saving: boolean }

export function SavingForm({ saving, children, ...props }: SavingFormProps) {
  return (
    <form {...props} aria-busy={saving}>
      <fieldset className="contents" disabled={saving}>
        {children}
      </fieldset>
    </form>
  )
}

type SaveButtonProps = ComponentPropsWithoutRef<'button'> & {
  saving: boolean
  icon?: ReactNode
  pendingLabel?: string
}

export function SaveButton({
  saving,
  icon,
  pendingLabel = 'Salvando...',
  children,
  disabled,
  className = 'primary-button',
  type = 'submit',
  ...props
}: SaveButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`${className} gap-2`}
      disabled={saving || disabled}
      aria-busy={saving || undefined}
    >
      {saving ? (
        <LoaderCircle size={17} className="shrink-0 motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {saving ? pendingLabel : children}
    </button>
  )
}

export type FormDestination = { to: string } | { href: string } | { onClick: () => void }

type FormExitProps = FormDestination & {
  blocked?: boolean
  children: ReactNode
  dirty?: boolean
}

export function FormExit({ blocked, dirty, children, ...destination }: FormExitProps) {
  const className = 'secondary-button gap-2 disabled:cursor-not-allowed disabled:opacity-60'

  function canExit() {
    return !dirty || window.confirm(UNSAVED_FORM_MESSAGE)
  }

  if (blocked) {
    return (
      <button className={className} type="button" disabled>
        {children}
      </button>
    )
  }

  if ('to' in destination) {
    return (
      <Link
        className={className}
        to={destination.to}
        onClick={(event) => {
          if (!canExit()) event.preventDefault()
        }}
      >
        {children}
      </Link>
    )
  }

  if ('href' in destination) {
    return (
      <a
        className={className}
        href={destination.href}
        onClick={(event) => {
          if (!canExit()) event.preventDefault()
        }}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        if (canExit()) destination.onClick()
      }}
    >
      {children}
    </button>
  )
}
