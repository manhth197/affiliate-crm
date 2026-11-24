import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '../generated/prisma/enums';
import type { MeDto } from '../users/dto/user.dto';
import { toMeDto } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import type { AuthResponseDto, TokenPairDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from '../users/password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /** Public sign-up is for affiliates only; STAFF/ADMIN accounts are created by an admin. */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Cheap pre-check so a duplicate does not pay for argon2. The unique index
    // still catches a concurrent duplicate (see UsersService.createAffiliate).
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email is already registered');
    }
    const user = await this.users.createAffiliate({
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      fullName: dto.fullName,
      phone: dto.phone,
    });
    const tokens = await this.tokens.issueTokenPair(user);
    return { user: toMeDto(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(dto.email);
    const passwordOk = user
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : await this.passwords.verifyAgainstDummy(dto.password);
    if (!user || !passwordOk) {
      // Same message for "no such email" and "wrong password".
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is disabled');
    }
    const tokens = await this.tokens.issueTokenPair(user);
    return { user: toMeDto(user), ...tokens };
  }

  refresh(refreshToken: string): Promise<TokenPairDto> {
    return this.tokens.rotate(refreshToken);
  }

  logout(userId: string, refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken, userId);
  }

  async me(userId: string): Promise<MeDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return toMeDto(user);
  }
}
