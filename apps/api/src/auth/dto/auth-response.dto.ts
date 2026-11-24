import { ApiSchema } from '@nestjs/swagger';
import { MeDto } from '../../users/dto/user.dto';

/**
 * Access token only. Since contract v0.7 the refresh token travels only in the
 * httpOnly `crm_rt` cookie, so page JavaScript never sees it.
 */
@ApiSchema({ name: 'TokenPair' })
export class TokenPairDto {
  /** JWT, valid for 15 minutes. Send as `Authorization: Bearer <accessToken>`. */
  accessToken!: string;

  /** Seconds until the access token expires. @example 900 */
  expiresIn!: number;
}

@ApiSchema({ name: 'AuthResponse' })
export class AuthResponseDto extends TokenPairDto {
  user!: MeDto;
}
