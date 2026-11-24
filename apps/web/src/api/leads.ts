import { apiRequest } from './client'
import type { CreateLeadRequest, Lead, LeadActivity, LeadQuery, Paginated } from './types'

export const leadsApi = {
  list: (query: LeadQuery, signal?: AbortSignal) =>
    apiRequest<Paginated<Lead>>('/leads', { query, signal }),

  get: (id: string, signal?: AbortSignal) =>
    apiRequest<Lead>(`/leads/${encodeURIComponent(id)}`, { signal }),

  /** Newest first. Affiliates do not receive NOTE entries. */
  activities: (id: string, signal?: AbortSignal) =>
    apiRequest<LeadActivity[]>(`/leads/${encodeURIComponent(id)}/activities`, { signal }),

  create: (body: CreateLeadRequest) => apiRequest<Lead>('/leads', { method: 'POST', body }),
}
