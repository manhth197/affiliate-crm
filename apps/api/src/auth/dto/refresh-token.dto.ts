import { ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@ApiSchema({ name: 'RefreshTokenRequest' })
export class RefreshTokenDto {
  /** The refresh token returned by login, register or the previous refresh. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}
