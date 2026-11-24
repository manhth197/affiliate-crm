import type { Commission, Lead, LeadActivity, Payout, User } from '@/api/types'
import { db } from './db'
import type { ActivityRecord, CommissionRecord, LeadRecord, PayoutRecord } from './records'

/** "0912345678" → "09******78" (first 2 + last 2 digits, ARCHITECTURE.md security notes). */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '*'.repeat(phone.length)
  return `${phone.slice(0, 2)}${'*'.repeat(phone.length - 4)}${phone.slice(-2)}`
}

/** "001234567890" → "*********890" (last 3 digits). */
export function maskNationalId(nationalId: string): string {
  return `${'*'.repeat(Math.max(0, nationalId.length - 3))}${nationalId.slice(-3)}`
}

function userRef(id: string) {
  const user = db.users.find((u) => u.id === id)
  return { id, fullName: user?.fullName ?? '(đã xóa)' }
}

/** Join a lead row into the API shape; PII is masked when the viewer is an affiliate. */
export function toLead(record: LeadRecord, viewer: User): Lead {
  const product = db.products.find((p) => p.id === record.productId)
  const profile = db.affiliates.find((a) => a.userId === record.affiliateId)
  const masked = viewer.role === 'AFFILIATE'
  return {
    id: record.id,
    code: record.code,
    affiliate: {
      ...userRef(record.affiliateId),
      referralCode: profile?.referralCode ?? '',
    },
    product: {
      id: record.productId,
      name: product?.name ?? '',
      partnerName: product?.partnerName ?? '',
    },
    customerName: record.customerName,
    customerPhone: masked ? maskPhone(record.customerPhone) : record.customerPhone,
    customerNationalId:
      record.customerNationalId && masked
        ? maskNationalId(record.customerNationalId)
        : record.customerNationalId,
    requestedAmount: record.requestedAmount,
    disbursedAmount: record.disbursedAmount,
    status: record.status,
    assignedStaff: record.assignedStaffId ? userRef(record.assignedStaffId) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function toActivity(record: ActivityRecord): LeadActivity {
  return {
    id: record.id,
    leadId: record.leadId,
    type: record.type,
    fromStatus: record.fromStatus,
    toStatus: record.toStatus,
    note: record.note,
    actor: record.actorId ? userRef(record.actorId) : null,
    createdAt: record.createdAt,
  }
}

export function toCommission(record: CommissionRecord): Commission {
  const lead = db.leads.find((l) => l.id === record.leadId)
  return {
    id: record.id,
    lead: { id: record.leadId, code: lead?.code ?? '', customerName: lead?.customerName ?? '' },
    affiliate: userRef(record.affiliateId),
    amount: record.amount,
    status: record.status,
    payoutId: record.payoutId,
    createdAt: record.createdAt,
  }
}

export function toPayout(record: PayoutRecord): Payout {
  return {
    id: record.id,
    affiliate: userRef(record.affiliateId),
    periodMonth: record.periodMonth,
    totalAmount: record.totalAmount,
    commissionCount: record.commissionCount,
    status: record.status,
    paidAt: record.paidAt,
    createdAt: record.createdAt,
  }
}
