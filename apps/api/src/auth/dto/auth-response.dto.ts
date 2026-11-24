import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MeDto } from '../../users/dto/user.dto';

@ApiSchema({ name: 'TokenPair' })
export class TokenPairDto {
  /** JWT, valid for 15 minutes. Send as `Authorization: Bearer <accessToken>`. */
  accessToken!: string;

  /**
   * Opaque token, valid for 7 days, single use: every refresh returns a new
   * one. Deprecated in the body (contract v0.6): it is also set as the
   * httpOnly `crm_rt` cookie, and v0.7 removes it from the body.
   */
  @ApiProperty({ deprecated: true })
  refreshToken!: string;

  /** Seconds until the access token expires. @example 900 */
  expiresIn!: number;
}

@ApiSchema({ name: 'AuthResponse' })
export class AuthResponseDto extends TokenPairDto {
  user!: MeDto;
}
