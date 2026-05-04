import { createHash, randomBytes } from 'node:crypto';

// Raw tokens are URL-safe random strings shown to the inviter exactly once;
// only the SHA-256 hash is stored. Acceptance hashes the user-supplied token
// and looks up the row by hash.

export function generateInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString('base64url');
  return { raw, hash: hashInviteToken(raw) };
}

export function hashInviteToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const INVITE_TTL_DAYS = 14;

export function inviteExpiry(now: Date = new Date()): Date {
  const e = new Date(now);
  e.setUTCDate(e.getUTCDate() + INVITE_TTL_DAYS);
  return e;
}
