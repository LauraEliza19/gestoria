import type { Ref } from 'react'
import { ArrowLeft } from 'lucide-react'
import { FormExit, type FormDestination } from './FormActions'
import { useUnsavedChangesWarning } from './useFormState'

type FormHeaderProps = {
  module: string
  title: string
  description: string
  mode: 'create' | 'edit'
  back: FormDestination & { label: string }
  dirty: boolean
  blocked?: boolean
  heading?: 'h1' | 'h2' | 'h3'
  headingId?: string
  headingRef?: Ref<HTMLHeadingElement>
  hasRequiredFields?: boolean
}

export function RequiredMark() {
  return (
    <>
      <span className="form-required-mark" aria-hidden="true">
        {' '}
        *
      </span>
      <span className="sr-only"> (obrigatório)</span>
    </>
  )
}

export function FormHeader({
  module,
  title,
  description,
  mode,
  back,
  dirty,
  blocked,
  heading: Heading = 'h1',
  headingId,
  headingRef,
  hasRequiredFields = true,
}: FormHeaderProps) {
  const { label, ...destination } = back

  useUnsavedChangesWarning(dirty && !blocked)

  return (
    <header className={`form-heading ${Heading === 'h1' ? 'page-header' : 'mb-4'}`}>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-signal-dark">
            {module}
          </span>
          <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-semibold text-[#354064]">
            {mode === 'create' ? 'Criação' : 'Edição'}
          </span>
        </div>
        <Heading
          id={headingId}
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={Heading === 'h1' ? undefined : 'font-display text-xl font-semibold'}
        >
          {title}
        </Heading>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {hasRequiredFields && (
            <span className="text-muted">
              Campos marcados com <span className="form-required-mark">*</span> são obrigatórios.
            </span>
          )}
          <span
            role="status"
            className={
              dirty ? 'inline-flex items-center gap-2 font-semibold text-[#805000]' : 'sr-only'
            }
          >
            {dirty && (
              <>
                <span className="h-2 w-2 rounded-full bg-[#b67512]" aria-hidden="true" />
                Alterações não salvas
              </>
            )}
          </span>
        </div>
      </div>
      <FormExit {...destination} blocked={blocked} dirty={dirty}>
        <ArrowLeft size={16} aria-hidden="true" />
        {label}
      </FormExit>
    </header>
  )
}
