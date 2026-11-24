import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { type Paginated, pageArgs, toPage } from '../common/dto/pagination.dto';
import { isUniqueViolation } from '../common/prisma-errors';
import { Prisma } from '../generated/prisma/client';
import { Role, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { StaffMemberDto, UserDto } from './dto/user.dto';
import { PasswordService } from './password.service';
import { generateReferralCode } from './referral-code';
import { toUserDto, type UserWithProfile } from './user.mapper';
import {
  conflict,
  ErrorCode,
  unprocessable,
} from '../common/errors/error-codes';

const REFERRAL_CODE_ATTEMPTS = 5;

export interface NewAffiliate {
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  findById(id: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { affiliateProfile: true },
    });
  }

  findByEmail(email: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { affiliateProfile: true },
    });
  }

  /**
   * Creates an AFFILIATE user and its profile in one insert. Retries with a new
   * referral code on the (rare) collision instead of checking first, which
   * would still race with a concurrent registration.
   */
  async createAffiliate(input: NewAffiliate): Promise<UserWithProfile> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.user.create({
          data: {
            ...input,
            email: input.email.toLowerCase(),
            role: Role.AFFILIATE,
            affiliateProfile: {
              create: { referralCode: generateReferralCode() },
            },
          },
          include: { affiliateProfile: true },
        });
      } catch (error) {
        if (isUniqueViolation(error, 'email')) {
          throw conflict(ErrorCode.EMAIL_TAKEN, 'Email is already registered');
        }
        if (
          isUniqueViolation(error, 'referral_code') &&
          attempt < REFERRAL_CODE_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  async list(query: ListUsersQueryDto): Promise<Paginated<UserDto>> {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
      ...(query.q && {
        OR: [
          { email: { contains: query.q, mode: 'insensitive' } },
          { fullName: { contains: query.q, mode: 'insensitive' } },
          { phone: { contains: query.q } },
        ],
      }),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(users.map(toUserDto), total, query);
  }

  /** Active STAFF and ADMIN users who can be assigned leads, sorted by name. */
  async listStaff(): Promise<StaffMemberDto[]> {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.STAFF, Role.ADMIN] },
        status: UserStatus.ACTIVE,
      },
      select: { id: true, fullName: true, role: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
    return staff.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      role: s.role as 'STAFF' | 'ADMIN',
    }));
  }

  async createStaff(dto: CreateUserDto, actorId: string): Promise<UserDto> {
    if (await this.findByEmail(dto.email)) {
      throw conflict(ErrorCode.EMAIL_TAKEN, 'Email is already registered');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            phone: dto.phone,
            role: dto.role,
          },
        });
        await this.audit.record(
          {
            actorId,
            action: 'USER_CREATED',
            entityType: 'User',
            entityId: created.id,
            after: { email: created.email, role: created.role },
          },
          tx,
        );
        return created;
      });
      return toUserDto(user);
    } catch (error) {
      if (isUniqueViolation(error, 'email')) {
        throw conflict(ErrorCode.EMAIL_TAKEN, 'Email is already registered');
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    if (id === actorId && dto.status === UserStatus.DISABLED) {
      throw unprocessable(
        ErrorCode.CANNOT_DISABLE_SELF,
        'You cannot disable your own account',
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: dto.status, fullName: dto.fullName, phone: dto.phone },
      });
      if (
        existing.status !== UserStatus.DISABLED &&
        updated.status === UserStatus.DISABLED
      ) {
        // End every session now; access tokens expire within 15 minutes.
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record(
        {
          actorId,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          before: pickEditable(existing),
          after: pickEditable(updated),
        },
        tx,
      );
      return updated;
    });
    return toUserDto(user);
  }
}

function pickEditable(user: {
  status: UserStatus;
  fullName: string;
  phone: string;
}): Prisma.InputJsonObject {
  return { status: user.status, fullName: user.fullName, phone: user.phone };
}
