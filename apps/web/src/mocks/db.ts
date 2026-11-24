import type { Me, User } from '@/api/types'
import { createSeed, type SeedData } from './seed'

export type MockSession = { userId: string; expiresAt: number }

export type MockDb = SeedData & {
  /** refresh token → session (rotated on every refresh, like the real API). */
  sessions: Record<string, MockSession>
  /**
   * The browser's `crm_rt` httpOnly cookie, as the API would see it (contract v0.6). MSW's own
   * cookie store is off under Node, so the mock keeps this one for browser and tests alike.
   */
  refreshCookie: string | null
}

// Bump the version when the shape changes, so stale saved data is ignored.
const STORAGE_KEY = 'affiliate-crm.mockDb.v4'

function freshDb(): MockDb {
  return { ...createSeed(), sessions: {}, refreshCookie: null }
}

/** The in-memory "database" behind the mock API. Mutated in place by handlers. */
export const db: MockDb = freshDb()

export function resetDb() {
  Object.assign(db, freshDb())
}

// ---- Browser persistence (mock mode only), so data survives a page reload ----
let persistence = false

/** Load saved data and save after every write from now on (browser mock mode only). */
export function enablePersistence() {
  persistence = true
  loadPersistedDb()
}

function loadPersistedDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) Object.assign(db, JSON.parse(raw) as MockDb)
  } catch {
    // Corrupt or unavailable storage: keep the fresh seed.
  }
}

/** No-op unless persistence is enabled (so tests never touch storage). */
export function persistDb() {
  if (!persistence) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // ignore (quota, privacy mode)
  }
}

export function clearPersistedDb() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// ---- Queries ----
export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase()
  return db.users.find((user) => user.email.toLowerCase() === normalized)
}

export function findUserById(id: string): User | undefined {
  return db.users.find((user) => user.id === id)
}

export function toMe(user: User): Me {
  const affiliate = db.affiliates.find((profile) => profile.userId === user.id)
  return affiliate ? { ...user, affiliate } : { ...user }
}

export function nextReferralCode(): string {
  const max = db.affiliates.reduce((highest, profile) => {
    const n = Number(profile.referralCode.replace(/\D/g, ''))
    return Number.isFinite(n) ? Math.max(highest, n) : highest
  }, 0)
  return `CTV${String(max + 1).padStart(3, '0')}`
}
