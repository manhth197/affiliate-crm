import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim, TrimLowercase } from '../../common/validation/transforms';
import { IsVnPhone, VN_MOBILE_PATTERN } from '../../common/validation/vn-phone';

@ApiSchema({ name: 'RegisterRequest' })
export class RegisterDto {
  /** @example "ctv.moi@example.com" */
  @TrimLowercase()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** At least 8 characters. @example "MatKhau@123" */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** @example "Trần Thị Bình" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({
    description:
      'VN mobile number. "+84", spaces and dots are accepted and normalised to 0XXXXXXXXX.',
    example: '0912345678',
    pattern: VN_MOBILE_PATTERN.source,
  })
  @IsVnPhone()
  phone!: string;
}
