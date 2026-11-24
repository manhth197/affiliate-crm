import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/env.validation';
import { REFRESH_COOKIE, refreshCookieOptions } from './refresh-cookie';

/** Sets and clears the `crm_rt` refresh-token cookie with the configured flags. */
@Injectable()
export class RefreshCookieService {
  private readonly options: CookieOptions;

  constructor(config: ConfigService<AppConfig, true>) {
    this.options = refreshCookieOptions(
      config.get('COOKIE_SECURE', { infer: true }),
      config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }),
    );
  }

  set(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE, refreshToken, this.options);
  }

  /** Same name, path and flags as when set, or the browser keeps the cookie. */
  clear(response: Response): void {
    const attributes: CookieOptions = { ...this.options };
    delete attributes.maxAge;
    response.clearCookie(REFRESH_COOKIE, attributes);
  }
}
