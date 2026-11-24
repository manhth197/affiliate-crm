import { ConflictException, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { generateReferralCode } from './referral-code';
import type { UserWithProfile } from './user.mapper';

const REFERRAL_CODE_ATTEMPTS = 5;

export interface NewAffiliate {
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
          throw new ConflictException('Email is already registered');
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
}
