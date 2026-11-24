import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Trim } from '../../common/validation/transforms';
import { Role, UserStatus } from '../../generated/prisma/enums';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: Role, enumName: 'Role', required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus', required: false })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** Searches email, full name and phone. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;
}
