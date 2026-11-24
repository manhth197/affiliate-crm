import { formatMonth, formatVnd } from '@/lib/format'
import { LEAD_STATUS_LABELS } from '@/lib/labels'
import type { CommissionRecord, LeadRecord, NotificationRecord, PayoutRecord } from './records'

/** The API writes notification texts in Vietnamese; the mock does the same. Pure builders. */
export type NotificationContent = Pick<NotificationRecord, 'type' | 'title' | 'body' | 'data'>
type Content = NotificationContent

export function leadStatusContent(lead: LeadRecord): Content {
  const label = LEAD_STATUS_LABELS[lead.status]
  return {
    type: 'LEAD_STATUS_CHANGED',
    title: `Lead ${lead.code}: ${label}`,
    body: `Khách hàng ${lead.customerName} đã chuyển sang “${label}”.`,
    data: { leadId: lead.id, leadCode: lead.code, status: lead.status },
  }
}

export function leadAssignedContent(lead: LeadRecord, productName: string): Content {
  return {
    type: 'LEAD_ASSIGNED',
    title: `Bạn được giao lead ${lead.code}`,
    body: `${lead.customerName} · ${productName}`,
    data: { leadId: lead.id, leadCode: lead.code },
  }
}

export function commissionCreatedContent(commission: CommissionRecord, lead: LeadRecord): Content {
  return {
    type: 'COMMISSION_CREATED',
    title: `Hoa hồng mới ${formatVnd(commission.amount)}`,
    body: `Lead ${lead.code} (${lead.customerName}) đã giải ngân.`,
    data: {
      commissionId: commission.id,
      leadId: lead.id,
      leadCode: lead.code,
      amount: String(commission.amount),
    },
  }
}

export function payoutPaidContent(payout: PayoutRecord): Content {
  return {
    type: 'PAYOUT_PAID',
    title: `Đã chi trả kỳ ${formatMonth(payout.periodMonth)}`,
    body: `${formatVnd(payout.totalAmount)} cho ${payout.commissionCount} khoản hoa hồng đã được chuyển khoản.`,
    data: {
      payoutId: payout.id,
      periodMonth: payout.periodMonth,
      totalAmount: String(payout.totalAmount),
    },
  }
}
