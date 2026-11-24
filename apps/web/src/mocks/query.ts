import type { Paginated } from '@/api/types'
import { apiError } from './http'

/**
 * Query-string parsing for the mock handlers. Invalid values answer 400 with `details`,
 * like the real API's validation pipe, so the UI's error handling gets exercised.
 */
export class QueryError {
  readonly response: Response
  constructor(response: Response) {
    this.response = response
  }
}

const invalid = (field: string, message: string) =>
  new QueryError(apiError(400, 'Validation failed', [{ field, message }]))

export function readQuery(request: Request) {
  const params = new URL(request.url).searchParams
  const get = (key: string) => {
    const value = params.get(key)
    return value === null || value === '' ? undefined : value
  }

  return {
    string: get,

    enum<T extends string>(key: string, allowed: readonly T[]): T | undefined {
      const value = get(key)
      if (value === undefined) return undefined
      if (!allowed.includes(value as T)) {
        throw invalid(key, `${key} must be one of: ${allowed.join(', ')}`)
      }
      return value as T
    },

    boolean(key: string): boolean | undefined {
      const value = get(key)
      if (value === undefined) return undefined
      if (value !== 'true' && value !== 'false') throw invalid(key, `${key} must be a boolean`)
      return value === 'true'
    },

    /** ISO 8601 datetime → epoch ms. */
    datetime(key: string): number | undefined {
      const value = get(key)
      if (value === undefined) return undefined
      const time = Date.parse(value)
      if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(time)) {
        throw invalid(key, `${key} must be an ISO 8601 date string`)
      }
      return time
    },

    month(key: string): string | undefined {
      const value = get(key)
      if (value !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
        throw invalid(key, `${key} must match YYYY-MM`)
      }
      return value
    },

    page() {
      const page = Number(get('page') ?? 1)
      const pageSize = Number(get('pageSize') ?? 20)
      if (!Number.isInteger(page) || page < 1) throw invalid('page', 'page must be ≥ 1')
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw invalid('pageSize', 'pageSize must be between 1 and 100')
      }
      return { page, pageSize }
    },
  }
}

export function paginate<T>(
  items: readonly T[],
  { page, pageSize }: { page: number; pageSize: number },
): Paginated<T> {
  const start = (page - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    meta: { page, pageSize, total: items.length },
  }
}

/** Lower-case and strip Vietnamese diacritics, so "nguyen" matches "Nguyễn". */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/** Wrap a resolver body so a thrown QueryError becomes its 400 response. */
export async function withQueryErrors(run: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof QueryError) return error.response
    throw error
  }
}

/** Strict bodies (contract v0.2): an unknown property is a 400. */
export function rejectUnknownProperties(
  body: Record<string, unknown>,
  allowed: readonly string[],
): Response | null {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key))
  if (unknown.length === 0) return null
  return apiError(
    400,
    'Validation failed',
    unknown.map((key) => ({ field: key, message: `property ${key} should not exist` })),
  )
}
