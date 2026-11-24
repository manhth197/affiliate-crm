import { LeadStatus, NotificationType } from '../generated/prisma/enums';

/** What the notifications queue stores and delivers. `data` is a flat string map (contract). */
export interface NotificationMessage {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Status labels shown to users (UI language is Vietnamese). */
export const LEAD_STATUS_LABEL: Readonly<Record<LeadStatus, string>> = {
  NEW: 'Mới',
  CONTACTED: 'Đã liên hệ',
  SUBMITTED: 'Đã nộp hồ sơ',
  APPROVED: 'Đã duyệt',
  DISBURSED: 'Đã giải ngân',
  REJECTED: 'Từ chối',
};

const vnd = new Intl.NumberFormat('vi-VN');

/** 1500000 → "1.500.000 ₫" */
export function formatVnd(amount: number | bigint): string {
  return `${vnd.format(amount)} ₫`;
}

export function leadStatusChangedMessage(input: {
  affiliateId: string;
  leadId: string;
  leadCode: string;
  from: LeadStatus;
  to: LeadStatus;
}): NotificationMessage {
  return {
    userId: input.affiliateId,
    type: NotificationType.LEAD_STATUS_CHANGED,
    title: `Lead ${input.leadCode}: ${LEAD_STATUS_LABEL[input.to]}`,
    body: `Trạng thái chuyển từ "${LEAD_STATUS_LABEL[input.from]}" sang "${LEAD_STATUS_LABEL[input.to]}".`,
    data: {
      leadId: input.leadId,
      leadCode: input.leadCode,
      status: input.to,
    },
  };
}

export function leadAssignedMessage(input: {
  staffId: string;
  leadId: string;
  leadCode: string;
}): NotificationMessage {
  return {
    userId: input.staffId,
    type: NotificationType.LEAD_ASSIGNED,
    title: `Bạn được giao lead ${input.leadCode}`,
    body: 'Hãy liên hệ khách hàng sớm nhất có thể.',
    data: { leadId: input.leadId, leadCode: input.leadCode },
  };
}

export function commissionCreatedMessage(input: {
  affiliateId: string;
  commissionId: string;
  leadId: string;
  leadCode: string;
  amount: number;
}): NotificationMessage {
  return {
    userId: input.affiliateId,
    type: NotificationType.COMMISSION_CREATED,
    title: `Hoa hồng mới: ${formatVnd(input.amount)}`,
    body: `Lead ${input.leadCode} đã giải ngân. Hoa hồng đang chờ duyệt.`,
    data: {
      commissionId: input.commissionId,
      leadId: input.leadId,
      leadCode: input.leadCode,
      amount: String(input.amount),
    },
  };
}
