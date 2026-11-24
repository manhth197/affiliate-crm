import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuditService } from '../audit/audit.service';
import { LeadActivityType, LeadStatus } from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import { LeadEvents, LeadStatusChangedEvent } from './lead.events';
import { LeadStatusService } from './lead-status.service';

function setup(currentStatus: LeadStatus | null) {
  const tx = {
    lead: {
      findUnique: jest
        .fn()
        .mockResolvedValue(currentStatus ? { status: currentStatus } : null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'lead-1',
        number: 7,
        affiliateId: 'aff-1',
        updatedAt: new Date('2026-11-24T10:00:00Z'),
      }),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const events = { emit: jest.fn() };
  const service = new LeadStatusService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    events as unknown as EventEmitter2,
  );
  return { service, tx, audit, events };
}

describe('LeadStatusService.changeStatus', () => {
  it('applies a staff change: conditional update, activity, audit, then event', async () => {
    const { service, tx, audit, events } = setup(LeadStatus.NEW);

    await service.changeStatus({
      leadId: 'lead-1',
      to: LeadStatus.CONTACTED,
      note: 'Đã gọi',
      source: { kind: 'user', userId: 'staff-1' },
    });

    expect(tx.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', status: LeadStatus.NEW },
      data: { status: LeadStatus.CONTACTED },
    });
    expect(tx.leadActivity.create).toHaveBeenCalledWith({
      data: {
        leadId: 'lead-1',
        type: LeadActivityType.STATUS_CHANGED,
        fromStatus: LeadStatus.NEW,
        toStatus: LeadStatus.CONTACTED,
        note: 'Đã gọi',
        actorId: 'staff-1',
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'staff-1',
        action: 'LEAD_STATUS_CHANGED',
        before: { status: LeadStatus.NEW },
        after: { status: LeadStatus.CONTACTED },
      }),
      tx,
    );
    expect(events.emit).toHaveBeenCalledWith(
      LeadEvents.StatusChanged,
      new LeadStatusChangedEvent(
        'lead-1',
        'LD-000007',
        'aff-1',
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        'staff-1',
        new Date('2026-11-24T10:00:00Z'),
      ),
    );
  });

  it('records a partner change as WEBHOOK with no actor and the event id in the audit', async () => {
    const { service, tx, audit } = setup(LeadStatus.APPROVED);

    await service.changeStatus({
      leadId: 'lead-1',
      to: LeadStatus.DISBURSED,
      disbursedAmount: 45_000_000,
      source: { kind: 'partner', partnerId: 'fe-credit', eventId: 'evt-1' },
    });

    expect(tx.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', status: LeadStatus.APPROVED },
      data: { status: LeadStatus.DISBURSED, disbursedAmount: 45_000_000n },
    });
    expect(tx.leadActivity.create.mock.calls[0][0].data).toMatchObject({
      type: LeadActivityType.WEBHOOK,
      actorId: null,
    });
    expect(audit.record.mock.calls[0][0]).toMatchObject({
      actorId: null,
      after: { status: LeadStatus.DISBURSED, disbursedAmount: 45_000_000 },
      metadata: { partnerId: 'fe-credit', eventId: 'evt-1' },
    });
  });

  it('rejects an invalid transition with 409 and changes nothing', async () => {
    const { service, tx, events } = setup(LeadStatus.NEW);
    await expect(
      service.changeStatus({
        leadId: 'lead-1',
        to: LeadStatus.APPROVED,
        source: { kind: 'user', userId: 'staff-1' },
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Cannot change status from NEW to APPROVED; allowed: CONTACTED, REJECTED',
      ),
    );
    expect(tx.lead.updateMany).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('returns 409 when another request changed the status first', async () => {
    const { service, tx, events } = setup(LeadStatus.NEW);
    tx.lead.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.changeStatus({
        leadId: 'lead-1',
        to: LeadStatus.CONTACTED,
        source: { kind: 'user', userId: 'staff-1' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.leadActivity.create).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown lead', async () => {
    const { service } = setup(null);
    await expect(
      service.changeStatus({
        leadId: 'missing',
        to: LeadStatus.CONTACTED,
        source: { kind: 'user', userId: 'staff-1' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires disbursedAmount for DISBURSED (e.g. from a webhook)', async () => {
    const { service } = setup(LeadStatus.APPROVED);
    await expect(
      service.changeStatus({
        leadId: 'lead-1',
        to: LeadStatus.DISBURSED,
        source: { kind: 'partner', partnerId: 'p', eventId: 'e' },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
