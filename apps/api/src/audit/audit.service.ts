import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction =
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_ASSIGNED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'COMMISSION_APPROVED'
  | 'COMMISSION_CANCELLED'
  | 'PAYOUT_CONFIRMED'
  | 'PAYOUT_PAID';

export type AuditEntityType =
  'Lead' | 'Product' | 'User' | 'Commission' | 'Payout';

export interface AuditEntry {
  /** Null for system actors (partner webhook, background jobs). */
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append-only audit trail. Pass the transaction client (`tx`) so the entry is
 * written atomically with the change it describes: no change without a log,
 * no log without a change.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    entry: AuditEntry,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.auditLog.create({ data: entry });
  }
}
