import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

type UrlValue = string | number | null | undefined

/**
 * List filters live in the URL query string: they survive reloads, can be shared as a link,
 * and the back button returns to the same filtered page after opening a detail page.
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams()

  const get = useCallback((key: string) => params.get(key) ?? '', [params])

  /** Set or remove keys. Any change other than `page` goes back to page 1. */
  const update = useCallback(
    (changes: Record<string, UrlValue>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === null || value === '') next.delete(key)
            else next.set(key, String(value))
          }
          if (!('page' in changes)) next.delete('page')
          return next
        },
        { replace: !('page' in changes) },
      )
    },
    [setParams],
  )

  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)

  return { params, get, update, page }
}
