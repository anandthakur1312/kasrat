import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPlatformAdmin } from './platform-admin.js';

const ORIGINAL = process.env.PLATFORM_ADMIN_EMAILS;

describe('isPlatformAdmin', () => {
  beforeEach(() => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = ORIGINAL;
  });

  it('returns false when allowlist is unset', () => {
    expect(isPlatformAdmin('anand@example.com')).toBe(false);
  });

  it('matches a single email exactly', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'anand@example.com';
    expect(isPlatformAdmin('anand@example.com')).toBe(true);
    expect(isPlatformAdmin('other@example.com')).toBe(false);
  });

  it('is case-insensitive on both sides', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'Anand@Example.COM';
    expect(isPlatformAdmin('anand@example.com')).toBe(true);
    expect(isPlatformAdmin('  ANAND@example.com  ')).toBe(true);
  });

  it('parses a comma-separated list and ignores empty entries', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'a@x.com, , b@x.com,';
    expect(isPlatformAdmin('a@x.com')).toBe(true);
    expect(isPlatformAdmin('b@x.com')).toBe(true);
    expect(isPlatformAdmin('c@x.com')).toBe(false);
  });
});
