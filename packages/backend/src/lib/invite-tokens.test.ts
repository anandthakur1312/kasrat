import { describe, expect, it } from 'vitest';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
} from './invite-tokens.js';

describe('generateInviteToken', () => {
  it('returns a URL-safe raw token and matching hash', () => {
    const { raw, hash } = generateInviteToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toBe(hashInviteToken(raw));
  });

  it('produces unique tokens across calls', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateInviteToken().raw));
    expect(tokens.size).toBe(50);
  });
});

describe('hashInviteToken', () => {
  it('is deterministic', () => {
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
  });

  it('returns a 64-char hex string (sha256)', () => {
    expect(hashInviteToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different inputs', () => {
    expect(hashInviteToken('abc')).not.toBe(hashInviteToken('abd'));
  });
});

describe('inviteExpiry', () => {
  it('is 14 days after the supplied now', () => {
    const now = new Date('2026-05-04T00:00:00Z');
    expect(inviteExpiry(now).toISOString()).toBe('2026-05-18T00:00:00.000Z');
  });
});
