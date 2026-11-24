import { http, HttpResponse } from 'msw'
import type { Health } from '@/api/types'
import { api } from '../http'
import { adminHandlers } from './admin'
import { authHandlers } from './auth'
import { catalogHandlers } from './catalog'
import { financeHandlers } from './finance'
import { leadActionHandlers } from './lead-actions'
import { leadHandlers } from './leads'
import { notificationHandlers } from './notifications'
import { reportHandlers } from './reports'

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...leadHandlers,
  ...leadActionHandlers,
  ...adminHandlers,
  ...financeHandlers,
  ...notificationHandlers,
  ...reportHandlers,
  http.get(api('/health'), () =>
    HttpResponse.json<Health>({ status: 'ok', db: 'up', redis: 'up' }),
  ),
]
