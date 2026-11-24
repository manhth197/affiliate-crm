import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validation/transforms';
import {
  IsVnPhone,
  VN_PHONE_API_PROPERTY,
} from '../../common/validation/vn-phone';
import { UserStatus } from '../../generated/prisma/enums';

@ApiSchema({ name: 'UpdateUserRequest' })
export class UpdateUserDto {
  /** Disabling a user also ends all of their sessions. */
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus', required: false })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({ ...VN_PHONE_API_PROPERTY, required: false })
  @IsOptional()
  @IsVnPhone()
  phone?: string;
}
