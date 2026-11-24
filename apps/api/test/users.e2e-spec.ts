import { ConflictException } from '@nestjs/common';
import * as referralCodes from '../src/users/referral-code';
import { UsersService } from '../src/users/users.service';
import {
  createTestApp,
  resetDatabase,
  type TestContext,
  uniqueEmail,
} from './utils';

/**
 * Exercises the unique-constraint handling against real Postgres, because the
 * shape of Prisma's P2002 error differs with driver adapters.
 */
describe('UsersService.createAffiliate (e2e, real DB)', () => {
  let ctx: TestContext;
  let users: UsersService;

  const input = (email = uniqueEmail('ctv')) => ({
    email,
    passwordHash: 'not-a-real-hash',
    fullName: 'Test CTV',
    phone: '0912345678',
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    users = ctx.app.get(UsersService);
    await resetDatabase(ctx.prisma);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await ctx.app.close();
  });

  it('turns a duplicate email that slipped past the pre-check into 409', async () => {
    const email = uniqueEmail('race');
    await users.createAffiliate(input(email));
    await expect(users.createAffiliate(input(email))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('retries with a new referral code when the generated one is taken', async () => {
    const first = await users.createAffiliate(input());
    const takenCode = first.affiliateProfile!.referralCode;

    jest
      .spyOn(referralCodes, 'generateReferralCode')
      .mockReturnValueOnce(takenCode)
      .mockReturnValueOnce('CTVFRESH2');

    const second = await users.createAffiliate(input());
    expect(second.affiliateProfile!.referralCode).toBe('CTVFRESH2');
  });

  it('gives up after repeated collisions and creates no user', async () => {
    const first = await users.createAffiliate(input());
    jest
      .spyOn(referralCodes, 'generateReferralCode')
      .mockReturnValue(first.affiliateProfile!.referralCode);

    const email = uniqueEmail('unlucky');
    await expect(users.createAffiliate(input(email))).rejects.toThrow();
    await expect(users.findByEmail(email)).resolves.toBeNull();
  });
});
