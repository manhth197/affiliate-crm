import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validation/transforms';
import { IsVnPhone, VN_MOBILE_PATTERN } from '../../common/validation/vn-phone';
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

  @ApiProperty({
    required: false,
    example: '0987654321',
    pattern: VN_MOBILE_PATTERN.source,
  })
  @IsOptional()
  @IsVnPhone()
  phone?: string;
}
