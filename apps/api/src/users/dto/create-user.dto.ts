import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim, TrimLowercase } from '../../common/validation/transforms';
import { IsVnPhone, VN_MOBILE_PATTERN } from '../../common/validation/vn-phone';
import { Role } from '../../generated/prisma/enums';

const STAFF_ROLES = [Role.STAFF, Role.ADMIN] as const;

/** Admin creates STAFF/ADMIN accounts; affiliates sign up themselves. */
@ApiSchema({ name: 'CreateUserRequest' })
export class CreateUserDto {
  /** @example "nhanvien2@demo.vn" */
  @TrimLowercase()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** At least 8 characters. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** @example "Đỗ Minh Khoa" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: '0987654321', pattern: VN_MOBILE_PATTERN.source })
  @IsVnPhone()
  phone!: string;

  @ApiProperty({ enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES)
  role!: 'STAFF' | 'ADMIN';
}
