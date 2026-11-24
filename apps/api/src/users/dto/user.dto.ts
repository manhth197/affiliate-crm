import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Role, UserStatus } from '../../generated/prisma/enums';

@ApiSchema({ name: 'User' })
export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** @example "ctv1@demo.vn" */
  email!: string;

  /** @example "Nguyễn Văn An" */
  fullName!: string;

  /** @example "0912345678" */
  phone!: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role!: Role;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

@ApiSchema({ name: 'AffiliateProfile' })
export class AffiliateProfileDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  /** @example "CTV7K3Q9Z" */
  referralCode!: string;

  bankName!: string | null;

  /** @example "******6789" */
  bankAccountMasked!: string | null;
}

/** The logged-in user. `affiliate` is present only for role AFFILIATE. */
@ApiSchema({ name: 'Me' })
export class MeDto extends UserDto {
  affiliate?: AffiliateProfileDto;
}
