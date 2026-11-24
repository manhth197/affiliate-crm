import { type Lead, LEAD_TRANSITIONS, type LeadStatus } from '@/api/types'

/** The amount that matters most: disbursed if known, otherwise requested. */
export function leadAmount(lead: Lead) {
  return lead.disbursedAmount ?? lead.requestedAmount
}

/** Same rule as the API's state machine; the API stays the authority (409 otherwise). */
export function canMove(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to)
}

/** Moves that need extra input: the disbursed amount, or a rejection reason. */
export function needsDialog(to: LeadStatus): boolean {
  return to === 'DISBURSED' || to === 'REJECTED'
}

export type DropPlan = 'ignore' | 'invalid' | 'dialog' | 'direct'

/** What a kanban drop of a lead in `from` onto column `to` should do. */
export function planDrop(from: LeadStatus, to: LeadStatus | null | undefined): DropPlan {
  if (!to || to === from) return 'ignore'
  if (!canMove(from, to)) return 'invalid'
  return needsDialog(to) ? 'dialog' : 'direct'
}
