import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validation/transforms';
import {
  IsVnPhone,
  VN_PHONE_API_PROPERTY,
} from '../../common/validation/vn-phone';

@ApiSchema({ name: 'UpdateMeRequest' })
export class UpdateMeDto {
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

  /** AFFILIATE only. @example "Vietcombank" */
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankName?: string;

  /** AFFILIATE only. 6–20 digits; spaces are ignored. Returned only masked. @example "0123456789" */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s/g, '') : value,
  )
  @Matches(/^\d{6,20}$/, { message: 'must be 6 to 20 digits' })
  bankAccountNumber?: string;
}
