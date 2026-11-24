import { apiRequest } from './client'
import type {
  AddLeadNoteRequest,
  AssignLeadRequest,
  ChangeLeadStatusRequest,
  CreateLeadRequest,
  Lead,
  LeadActivity,
  LeadQuery,
  Paginated,
} from './types'

export const leadsApi = {
  list: (query: LeadQuery, signal?: AbortSignal) =>
    apiRequest<Paginated<Lead>>('/leads', { query, signal }),

  get: (id: string, signal?: AbortSignal) =>
    apiRequest<Lead>(`/leads/${encodeURIComponent(id)}`, { signal }),

  /** Newest first. Affiliates do not receive NOTE entries. */
  activities: (id: string, signal?: AbortSignal) =>
    apiRequest<LeadActivity[]>(`/leads/${encodeURIComponent(id)}/activities`, { signal }),

  create: (body: CreateLeadRequest) => apiRequest<Lead>('/leads', { method: 'POST', body }),

  /** STAFF/ADMIN. 409 INVALID_TRANSITION or CONCURRENT_UPDATE when the lead changed meanwhile. */
  changeStatus: (id: string, body: ChangeLeadStatusRequest) =>
    apiRequest<Lead>(`/leads/${encodeURIComponent(id)}/status`, { method: 'PATCH', body }),

  /** STAFF/ADMIN. 422 ASSIGNEE_NOT_STAFF if the user cannot take leads. */
  assign: (id: string, body: AssignLeadRequest) =>
    apiRequest<Lead>(`/leads/${encodeURIComponent(id)}/assign`, { method: 'PATCH', body }),

  /** STAFF/ADMIN. Internal note, hidden from the affiliate. */
  addNote: (id: string, body: AddLeadNoteRequest) =>
    apiRequest<LeadActivity>(`/leads/${encodeURIComponent(id)}/notes`, { method: 'POST', body }),
}
