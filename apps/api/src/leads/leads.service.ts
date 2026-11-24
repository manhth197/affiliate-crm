import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { CSV_BOM, toCsvLine } from '../common/csv';
import { toSearchText } from '../common/search-text';
import { type Paginated, pageArgs, toPage } from '../common/dto/pagination.dto';
import {
  LeadActivityType,
  LeadStatus,
  ProductCategory,
  Role,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { LeadActivityDto, LeadDto } from './dto/lead.dto';
import type {
  ChangeLeadStatusDto,
  CreateLeadDto,
} from './dto/lead-requests.dto';
import type { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { formatLeadCode } from './lead-code';
import { LEAD_CSV_HEADERS, leadCsvRow } from './lead-csv';
import { LeadAssignedEvent, LeadCreatedEvent, LeadEvents } from './lead.events';
import { buildLeadOrderBy, buildLeadWhere } from './lead-filters';
import {
  activityInclude,
  leadInclude,
  type LeadWithRelations,
} from './lead.include';
import { toLeadActivityDto, toLeadDto } from './lead.mapper';
import { OPEN_STATUSES } from './lead-status.machine';
import { LeadStatusService } from './lead-status.service';
import {
  conflict,
  ErrorCode,
  unprocessable,
} from '../common/errors/error-codes';

const EXPORT_BATCH_SIZE = 500;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: LeadStatusService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async list(
    query: ListLeadsQueryDto,
    viewer: AuthUser,
  ): Promise<Paginated<LeadDto>> {
    const where = buildLeadWhere(query, viewer);
    const [leads, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: buildLeadOrderBy(query.sort),
        ...pageArgs(query),
      }),
      this.prisma.lead.count({ where }),
    ]);
    return toPage(
      leads.map((lead) => toLeadDto(lead, viewer)),
      total,
      query,
    );
  }

  async findOne(id: string, viewer: AuthUser): Promise<LeadDto> {
    return toLeadDto(await this.getVisibleLead(id, viewer), viewer);
  }

  async create(dto: CreateLeadDto, affiliate: AuthUser): Promise<LeadDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.active) {
      throw unprocessable(
        ErrorCode.PRODUCT_UNAVAILABLE,
        'Product is not available',
      );
    }
    if (
      dto.requestedAmount !== undefined &&
      product.category !== ProductCategory.LOAN
    ) {
      throw unprocessable(
        ErrorCode.AMOUNT_NOT_ALLOWED,
        'requestedAmount is only allowed for LOAN products',
      );
    }

    const lead = await this.prisma.$transaction(async (tx) => {
      // Serialise concurrent submissions for the same customer + product so
      // the duplicate check below cannot race (lock released at COMMIT).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${product.id}:${dto.customerPhone}`}))`;
      const duplicate = await tx.lead.findFirst({
        where: {
          productId: product.id,
          customerPhone: dto.customerPhone,
          status: { in: [...OPEN_STATUSES] },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw conflict(
          ErrorCode.DUPLICATE_LEAD,
          'This customer already has an open lead for this product',
        );
      }
      const created = await tx.lead.create({
        data: {
          affiliateId: affiliate.id,
          productId: product.id,
          customerName: dto.customerName,
          customerNameSearch: toSearchText(dto.customerName),
          customerPhone: dto.customerPhone,
          customerNationalId: dto.customerNationalId ?? null,
          requestedAmount:
            dto.requestedAmount === undefined
              ? null
              : BigInt(dto.requestedAmount),
          activities: {
            create: {
              type: LeadActivityType.CREATED,
              toStatus: LeadStatus.NEW,
              note: dto.note ?? null,
              actorId: affiliate.id,
            },
          },
        },
        include: leadInclude,
      });
      return created;
    });

    this.events.emit(
      LeadEvents.Created,
      new LeadCreatedEvent(
        lead.id,
        formatLeadCode(lead.number),
        lead.affiliateId,
      ),
    );
    return toLeadDto(lead, affiliate);
  }

  async changeStatus(
    id: string,
    dto: ChangeLeadStatusDto,
    actor: AuthUser,
  ): Promise<LeadDto> {
    if (
      dto.status !== LeadStatus.DISBURSED &&
      dto.disbursedAmount !== undefined
    ) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: [
          {
            field: 'disbursedAmount',
            message: 'is only allowed when status is DISBURSED',
          },
        ],
      });
    }
    const lead = await this.statuses.changeStatus({
      leadId: id,
      to: dto.status,
      note: dto.note,
      disbursedAmount: dto.disbursedAmount,
      source: { kind: 'user', userId: actor.id },
    });
    return toLeadDto(lead, actor);
  }

  async assign(id: string, staffId: string, actor: AuthUser): Promise<LeadDto> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true, assignedStaffId: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, fullName: true, role: true, status: true },
    });
    if (
      !staff ||
      staff.status !== UserStatus.ACTIVE ||
      (staff.role !== Role.STAFF && staff.role !== Role.ADMIN)
    ) {
      throw unprocessable(
        ErrorCode.ASSIGNEE_NOT_STAFF,
        'staffId must be an active STAFF or ADMIN user',
      );
    }
    if (lead.assignedStaffId === staffId) {
      // Idempotent: re-assigning to the same person changes nothing.
      return this.findOne(id, actor);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id },
        data: { assignedStaffId: staffId },
        include: leadInclude,
      });
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: LeadActivityType.ASSIGNED,
          assigneeId: staffId,
          actorId: actor.id,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'LEAD_ASSIGNED',
          entityType: 'Lead',
          entityId: id,
          before: { assignedStaffId: lead.assignedStaffId },
          after: { assignedStaffId: staffId },
        },
        tx,
      );
      return result;
    });

    this.events.emit(
      LeadEvents.Assigned,
      new LeadAssignedEvent(
        id,
        formatLeadCode(updated.number),
        staffId,
        actor.id,
      ),
    );
    return toLeadDto(updated, actor);
  }

  async addNote(
    id: string,
    note: string,
    actor: AuthUser,
  ): Promise<LeadActivityDto> {
    const exists = await this.prisma.lead.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Lead not found');
    }
    const activity = await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        type: LeadActivityType.NOTE,
        note,
        actorId: actor.id,
      },
      include: activityInclude,
    });
    return toLeadActivityDto(activity);
  }

  /** Timeline, newest first. Affiliates do not see internal NOTE entries. */
  async activities(id: string, viewer: AuthUser): Promise<LeadActivityDto[]> {
    await this.getVisibleLead(id, viewer);
    const activities = await this.prisma.leadActivity.findMany({
      where: {
        leadId: id,
        ...(viewer.role === Role.AFFILIATE && {
          type: { not: LeadActivityType.NOTE },
        }),
      },
      include: activityInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return activities.map(toLeadActivityDto);
  }

  /**
   * Streams the CSV in batches with keyset (cursor) pagination, so memory use
   * stays flat however many leads match.
   */
  async *exportCsv(
    query: ListLeadsQueryDto,
    viewer: AuthUser,
  ): AsyncGenerator<string> {
    yield CSV_BOM + toCsvLine(LEAD_CSV_HEADERS);
    const where = buildLeadWhere(query, viewer);
    const orderBy = buildLeadOrderBy(query.sort);
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy,
        take: EXPORT_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const lead of batch) {
        yield toCsvLine(leadCsvRow(lead));
      }
      if (batch.length < EXPORT_BATCH_SIZE) {
        return;
      }
      cursor = batch[batch.length - 1].id;
    }
  }

  /** 404 if missing; 403 if an affiliate asks for someone else's lead. */
  private async getVisibleLead(
    id: string,
    viewer: AuthUser,
  ): Promise<LeadWithRelations> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (viewer.role === Role.AFFILIATE && lead.affiliateId !== viewer.id) {
      throw new ForbiddenException('You can only access your own leads');
    }
    return lead;
  }
}
