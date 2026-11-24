import { http, HttpResponse } from 'msw'
import type { Health } from '@/api/types'
import { api } from '../http'
import { authHandlers } from './auth'
import { catalogHandlers } from './catalog'
import { financeHandlers } from './finance'
import { leadHandlers } from './leads'

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...leadHandlers,
  ...financeHandlers,
  http.get(api('/health'), () =>
    HttpResponse.json<Health>({ status: 'ok', db: 'up', redis: 'up' }),
  ),
]
