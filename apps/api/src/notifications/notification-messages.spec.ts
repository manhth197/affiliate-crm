import { LeadStatus, NotificationType } from '../generated/prisma/enums';
import {
  commissionCreatedMessage,
  formatVnd,
  LEAD_STATUS_LABEL,
  leadAssignedMessage,
  leadStatusChangedMessage,
} from './notification-messages';

describe('notification messages', () => {
  it('formats VND the Vietnamese way', () => {
    expect(formatVnd(1_500_000)).toBe('1.500.000 ₫');
    expect(formatVnd(0)).toBe('0 ₫');
  });

  it('has a label for every lead status', () => {
    for (const status of Object.values(LeadStatus)) {
      expect(LEAD_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it('builds a status-change message for the affiliate', () => {
    expect(
      leadStatusChangedMessage({
        affiliateId: 'aff-1',
        leadId: 'lead-1',
        leadCode: 'LD-000007',
        from: LeadStatus.SUBMITTED,
        to: LeadStatus.APPROVED,
      }),
    ).toEqual({
      userId: 'aff-1',
      type: NotificationType.LEAD_STATUS_CHANGED,
      title: 'Lead LD-000007: Đã duyệt',
      body: 'Trạng thái chuyển từ "Đã nộp hồ sơ" sang "Đã duyệt".',
      data: { leadId: 'lead-1', leadCode: 'LD-000007', status: 'APPROVED' },
    });
  });

  it('keeps data values as strings', () => {
    const message = commissionCreatedMessage({
      affiliateId: 'aff-1',
      commissionId: 'c-1',
      leadId: 'lead-1',
      leadCode: 'LD-000007',
      amount: 750_000,
    });
    expect(message.title).toBe('Hoa hồng mới: 750.000 ₫');
    expect(
      Object.values(message.data).every((v) => typeof v === 'string'),
    ).toBe(true);
    expect(message.data.amount).toBe('750000');
  });

  it('notifies the assignee', () => {
    expect(
      leadAssignedMessage({
        staffId: 's-1',
        leadId: 'l',
        leadCode: 'LD-000001',
      }),
    ).toMatchObject({ userId: 's-1', type: NotificationType.LEAD_ASSIGNED });
  });
});
