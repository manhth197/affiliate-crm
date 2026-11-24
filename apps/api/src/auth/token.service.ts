import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../config/env.validation';
import { Role, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh tokens are opaque random strings (256 bits), not JWTs. Only their
 * SHA-256 hash is stored: a fast hash is enough because the input is random
 * (no dictionary to brute-force), and it lets us look the token up by index.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class TokenService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.refreshTtlMs =
      config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  /** Starts a session (login/register): new access token + new refresh-token family. */
  async issueTokenPair(user: { id: string; role: Role }): Promise<TokenPair> {
    const refreshToken = newOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return { accessToken: await this.signAccessToken(user), refreshToken };
  }

  /**
   * Rotation: each refresh token works once and is replaced by a new one in
   * the same family. Presenting a token that was already rotated means it was
   * probably stolen, so the whole family (that login session) is revoked.
   */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const now = new Date();
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      include: { user: { select: { id: true, role: true, status: true } } },
    });
    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.revokedAt) {
      await this.revokeFamily(record.familyId, now);
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    if (record.expiresAt <= now) {
      throw new UnauthorizedException('Refresh token has expired');
    }
    if (record.user.status !== UserStatus.ACTIVE) {
      await this.revokeFamily(record.familyId, now);
      throw new ForbiddenException('Account is disabled');
    }

    const nextToken = newOpaqueToken();
    await this.prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: {
          userId: record.userId,
          familyId: record.familyId,
          tokenHash: hashRefreshToken(nextToken),
          expiresAt: new Date(now.getTime() + this.refreshTtlMs),
        },
        select: { id: true },
      });
      // Conditional update: if two requests race with the same token, only one
      // sees revokedAt = null; the other rolls back and gets 401.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: now, replacedById: next.id },
      });
      if (count !== 1) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }
    });

    return {
      accessToken: await this.signAccessToken(record.user),
      refreshToken: nextToken,
    };
  }

  /** Logout: revokes one refresh token of this user. Unknown tokens are ignored. */
  async revoke(refreshToken: string, userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(user: { id: string; role: Role }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload);
  }

  private async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
