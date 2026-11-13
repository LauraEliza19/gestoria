import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { FormSuccessContext } from './useFormState'

export function FormSuccessProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string } | null>(null)
  const announce = useCallback((message: string) => setNotice({ message }), [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 7000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <FormSuccessContext.Provider value={announce}>
      {children}
      <div
        role="status"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end print:hidden"
      >
        {notice && (
          <p className="max-w-md rounded-lg border border-[#bce1cf] bg-[#f0fbf5] px-4 py-3 text-sm font-semibold text-[#216146] shadow-lg">
            {notice.message}
          </p>
        )}
      </div>
    </FormSuccessContext.Provider>
  )
}
