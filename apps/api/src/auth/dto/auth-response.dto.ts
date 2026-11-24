import { ApiSchema } from '@nestjs/swagger';
import { MeDto } from '../../users/dto/user.dto';

@ApiSchema({ name: 'TokenPair' })
export class TokenPairDto {
  /** JWT, valid for 15 minutes. Send as `Authorization: Bearer <accessToken>`. */
  accessToken!: string;

  /** Opaque token, valid for 7 days, single use: every refresh returns a new one. */
  refreshToken!: string;
}

@ApiSchema({ name: 'AuthResponse' })
export class AuthResponseDto extends TokenPairDto {
  user!: MeDto;
}
