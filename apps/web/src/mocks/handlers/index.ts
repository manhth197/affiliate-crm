import { http, HttpResponse } from 'msw'
import { api } from '../http'
import { authHandlers } from './auth'

export const handlers = [
  ...authHandlers,
  http.get(api('/health'), () => HttpResponse.json({ status: 'ok', db: 'up', redis: 'up' })),
]
