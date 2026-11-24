import type { AuthUser } from '../auth/auth.types';
import { LeadStatus, Role } from '../generated/prisma/enums';
import {
  buildLeadOrderBy,
  buildLeadWhere,
  LEAD_SORT_PATTERN,
} from './lead-filters';

const affiliate: AuthUser = { id: 'aff-1', role: Role.AFFILIATE };
const staff: AuthUser = { id: 'staff-1', role: Role.STAFF };

describe('buildLeadWhere', () => {
  it('always limits an affiliate to their own leads, ignoring affiliateId', () => {
    const where = buildLeadWhere({ affiliateId: 'someone-else' }, affiliate);
    expect(where.affiliateId).toBe('aff-1');
  });

  it('lets staff filter by any affiliate, or none', () => {
    expect(buildLeadWhere({ affiliateId: 'aff-9' }, staff).affiliateId).toBe(
      'aff-9',
    );
    expect(buildLeadWhere({}, staff).affiliateId).toBeUndefined();
  });

  it('passes simple filters through', () => {
    const where = buildLeadWhere(
      { status: LeadStatus.APPROVED, productId: 'p1', assignedStaffId: 's1' },
      staff,
    );
    expect(where).toMatchObject({
      status: LeadStatus.APPROVED,
      productId: 'p1',
      assignedStaffId: 's1',
    });
  });

  it('uses a half-open createdAt range', () => {
    const where = buildLeadWhere(
      { from: '2026-11-01T00:00:00+07:00', to: '2026-12-01T00:00:00+07:00' },
      staff,
    );
    expect(where.createdAt).toEqual({
      gte: new Date('2026-10-31T17:00:00Z'),
      lt: new Date('2026-11-30T17:00:00Z'),
    });
  });

  it('searches name only for plain text', () => {
    expect(buildLeadWhere({ q: 'Mai' }, staff).OR).toEqual([
      { customerName: { contains: 'Mai', mode: 'insensitive' } },
    ]);
  });

  it('also matches the lead code', () => {
    expect(buildLeadWhere({ q: 'LD-000123' }, staff).OR).toContainEqual({
      number: 123,
    });
  });

  it('also matches phone digits, normalising +84 and separators', () => {
    expect(buildLeadWhere({ q: '+84 912.345' }, staff).OR).toContainEqual({
      customerPhone: { contains: '0912345' },
    });
    // Too short to be a useful phone search.
    expect(buildLeadWhere({ q: '09' }, staff).OR).toHaveLength(1);
  });
});

describe('buildLeadOrderBy', () => {
  it('defaults to newest first with an id tie-breaker', () => {
    expect(buildLeadOrderBy()).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('puts nulls last for optional amounts', () => {
    expect(buildLeadOrderBy('requestedAmount:asc')).toEqual([
      { requestedAmount: { sort: 'asc', nulls: 'last' } },
      { id: 'asc' },
    ]);
  });

  it('only allows whitelisted fields', () => {
    expect(LEAD_SORT_PATTERN.test('updatedAt:asc')).toBe(true);
    expect(LEAD_SORT_PATTERN.test('customerPhone:asc')).toBe(false);
    expect(LEAD_SORT_PATTERN.test('createdAt:sideways')).toBe(false);
  });
});
