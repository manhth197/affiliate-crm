import { maskBankAccount } from '../common/masking';
import type { AffiliateProfile, User } from '../generated/prisma/client';
import type { MeDto, UserDto } from './dto/user.dto';

export type UserWithProfile = User & {
  affiliateProfile: AffiliateProfile | null;
};

/** Maps a DB row to the public User shape. Never exposes passwordHash. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toMeDto(user: UserWithProfile): MeDto {
  const me: MeDto = toUserDto(user);
  const profile = user.affiliateProfile;
  if (profile) {
    me.affiliate = {
      userId: profile.userId,
      referralCode: profile.referralCode,
      bankName: profile.bankName,
      bankAccountMasked: profile.bankAccount
        ? maskBankAccount(profile.bankAccount)
        : null,
    };
  }
  return me;
}
