import { LeadActivityType, LeadStatus, Role } from '../generated/prisma/enums';
import { leadCsvRow } from './lead-csv';
import type { ActivityWithActor, LeadWithRelations } from './lead.include';
import { toLeadActivityDto, toLeadDto } from './lead.mapper';

function lead(overrides: Partial<LeadWithRelations> = {}): LeadWithRelations {
  return {
    id: 'lead-1',
    number: 123,
    affiliateId: 'aff-1',
    productId: 'prod-1',
    customerName: 'Hoàng Thị Mai',
    customerNameSearch: 'hoang thi mai',
    customerPhone: '0912345689',
    customerNationalId: '001203004123',
    requestedAmount: 50_000_000n,
    disbursedAmount: null,
    status: LeadStatus.NEW,
    assignedStaffId: null,
    createdAt: new Date('2026-11-24T08:30:00Z'),
    updatedAt: new Date('2026-11-24T09:00:00Z'),
    affiliate: {
      id: 'aff-1',
      fullName: 'Nguyễn Văn An',
      affiliateProfile: { referralCode: 'CTVDEMA22' },
    },
    product: { id: 'prod-1', name: 'Vay tín chấp', partnerName: 'FE Credit' },
    assignedStaff: null,
    ...overrides,
  };
}

describe('toLeadDto', () => {
  it('masks phone and national ID for affiliates', () => {
    const dto = toLeadDto(lead(), { id: 'aff-1', role: Role.AFFILIATE });
    expect(dto.customerPhone).toBe('09******89');
    expect(dto.customerNationalId).toBe('*********123');
  });

  it.each([Role.STAFF, Role.ADMIN])('shows full PII to %s', (role) => {
    const dto = toLeadDto(lead(), { id: 'u', role });
    expect(dto.customerPhone).toBe('0912345689');
    expect(dto.customerNationalId).toBe('001203004123');
  });

  it('keeps a missing national ID as null', () => {
    const dto = toLeadDto(lead({ customerNationalId: null }), {
      id: 'aff-1',
      role: Role.AFFILIATE,
    });
    expect(dto.customerNationalId).toBeNull();
  });

  it('formats the code, converts BIGINT money and dates', () => {
    const dto = toLeadDto(
      lead({
        disbursedAmount: 45_000_000n,
        assignedStaff: { id: 's1', fullName: 'Phạm Thu Hà' },
      }),
      { id: 's1', role: Role.STAFF },
    );
    expect(dto).toMatchObject({
      code: 'LD-000123',
      requestedAmount: 50_000_000,
      disbursedAmount: 45_000_000,
      assignedStaff: { id: 's1', fullName: 'Phạm Thu Hà' },
      affiliate: {
        id: 'aff-1',
        fullName: 'Nguyễn Văn An',
        referralCode: 'CTVDEMA22',
      },
      createdAt: '2026-11-24T08:30:00.000Z',
    });
    expect(typeof dto.requestedAmount).toBe('number');
  });
});

describe('toLeadActivityDto', () => {
  it('returns a null actor for webhook entries', () => {
    const activity: ActivityWithActor = {
      id: 'a1',
      leadId: 'lead-1',
      type: LeadActivityType.WEBHOOK,
      fromStatus: LeadStatus.SUBMITTED,
      toStatus: LeadStatus.APPROVED,
      note: null,
      actorId: null,
      assigneeId: null,
      createdAt: new Date('2026-11-24T10:00:00Z'),
      actor: null,
      assignee: null,
    };
    expect(toLeadActivityDto(activity)).toEqual({
      id: 'a1',
      leadId: 'lead-1',
      type: LeadActivityType.WEBHOOK,
      fromStatus: LeadStatus.SUBMITTED,
      toStatus: LeadStatus.APPROVED,
      note: null,
      actor: null,
      assignee: null,
      createdAt: '2026-11-24T10:00:00.000Z',
    });
  });
});

describe('leadCsvRow', () => {
  it('is unmasked and uses Vietnam time', () => {
    const row = leadCsvRow(lead());
    expect(row).toEqual([
      'LD-000123',
      '2026-11-24 15:30',
      'NEW',
      'Nguyễn Văn An',
      'CTVDEMA22',
      'Vay tín chấp',
      'FE Credit',
      'Hoàng Thị Mai',
      '0912345689',
      '001203004123',
      50_000_000,
      null,
      '',
    ]);
  });
});
