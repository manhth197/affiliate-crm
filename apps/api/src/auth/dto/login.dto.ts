import { ApiSchema } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimLowercase } from '../../common/validation/transforms';

@ApiSchema({ name: 'LoginRequest' })
export class LoginDto {
  /** @example "ctv1@demo.vn" */
  @TrimLowercase()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** @example "Demo@12345" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
