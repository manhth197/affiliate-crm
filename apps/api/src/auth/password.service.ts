import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * argon2id password hashing (OWASP's first choice). The library defaults
 * (64 MiB memory, 3 iterations) are above the OWASP minimum.
 */
@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Burns the same CPU time as a real check when the email does not exist,
   * so response time does not reveal which emails are registered.
   */
  async verifyAgainstDummy(plain: string): Promise<false> {
    this.dummyHash ??= this.hash('timing-equaliser-not-a-real-password');
    await this.verify(await this.dummyHash, plain);
    return false;
  }
}
