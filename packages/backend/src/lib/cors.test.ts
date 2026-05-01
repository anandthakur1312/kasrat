import { describe, expect, it } from 'vitest';
import { isCorsOriginAllowed } from './cors.js';

describe('isCorsOriginAllowed', () => {
  it('allows non-browser requests without an Origin header', () => {
    expect(isCorsOriginAllowed(undefined, { NODE_ENV: 'production' })).toBe(true);
  });

  it('allows production Kasrat origins', () => {
    expect(isCorsOriginAllowed('https://kasrat.pages.dev', { NODE_ENV: 'production' })).toBe(true);
    expect(isCorsOriginAllowed('https://kasrat.in', { NODE_ENV: 'production' })).toBe(true);
    expect(isCorsOriginAllowed('https://www.kasrat.in', { NODE_ENV: 'production' })).toBe(true);
  });

  it('allows Cloudflare Pages preview origins for the Kasrat project', () => {
    expect(
      isCorsOriginAllowed('https://feature-payments.kasrat.pages.dev', {
        NODE_ENV: 'production',
      }),
    ).toBe(true);
  });

  it('allows comma-separated configured origins', () => {
    expect(
      isCorsOriginAllowed('https://preview.example.com', {
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://one.example.com, https://preview.example.com',
      }),
    ).toBe(true);
  });

  it('allows localhost only outside production', () => {
    expect(isCorsOriginAllowed('http://localhost:5174', { NODE_ENV: 'development' })).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:5174', { NODE_ENV: 'production' })).toBe(false);
  });

  it('blocks unrelated browser origins in production', () => {
    expect(isCorsOriginAllowed('https://evil.example.com', { NODE_ENV: 'production' })).toBe(false);
  });
});
