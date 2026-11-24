import { cn } from 'cn'
import type { CommissionStatus, LeadStatus, PayoutStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { COMMISSION_STATUS_LABELS, LEAD_STATUS_LABELS, PAYOUT_STATUS_LABELS } from '@/lib/labels'

type Tone = 'gray' | 'sky' | 'indigo' | 'violet' | 'amber' | 'emerald' | 'rose'

const TONE_CLASSES: Record<Tone, string> = {
  gray: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
}

const LEAD_TONES: Record<LeadStatus, Tone> = {
  NEW: 'sky',
  CONTACTED: 'indigo',
  SUBMITTED: 'violet',
  APPROVED: 'amber',
  DISBURSED: 'emerald',
  REJECTED: 'rose',
}

const COMMISSION_TONES: Record<CommissionStatus, Tone> = {
  PENDING: 'amber',
  APPROVED: 'sky',
  PAID: 'emerald',
  CANCELLED: 'gray',
}

const PAYOUT_TONES: Record<PayoutStatus, Tone> = {
  DRAFT: 'gray',
  CONFIRMED: 'sky',
  PAID: 'emerald',
}

function ToneBadge({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', TONE_CLASSES[tone], className)}>
      {label}
    </Badge>
  )
}

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <ToneBadge tone={LEAD_TONES[status]} label={LEAD_STATUS_LABELS[status]} className={className} />
  )
}

export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  return <ToneBadge tone={COMMISSION_TONES[status]} label={COMMISSION_STATUS_LABELS[status]} />
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return <ToneBadge tone={PAYOUT_TONES[status]} label={PAYOUT_STATUS_LABELS[status]} />
}
