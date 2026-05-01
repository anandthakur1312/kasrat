const RESERVED_SLUGS = [
  'admin',
  'api',
  'auth',
  'backup',
  'billing',
  'blog',
  'contact',
  'dashboard',
  'docs',
  'faq',
  'g',
  'help',
  'home',
  'login',
  'logout',
  'members',
  'new',
  'payments',
  'plans',
  'pricing',
  'privacy',
  'public',
  'robots.txt',
  'settings',
  'setup',
  'sign-in',
  'sign-up',
  'sitemap.xml',
  'status',
  'support',
  'terms',
  'www',
] as const;

export type SlugValidationCode =
  | 'SLUG_INVALID_FORMAT'
  | 'SLUG_RESERVED';

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; slug: string; code: SlugValidationCode };

const RESERVED_SLUG_SET = new Set<string>(RESERVED_SLUGS);
const VALID_SLUG_PATTERN = /^[a-z0-9-]+$/;

export function slugifySlugInput(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(normalizeSlug(slug));
}

export function validateSlug(value: string): SlugValidationResult {
  const slug = normalizeSlug(value);
  const hasValidShape =
    slug.length >= 2 &&
    slug.length <= 32 &&
    VALID_SLUG_PATTERN.test(slug) &&
    !slug.startsWith('-') &&
    !slug.endsWith('-') &&
    !slug.includes('--');

  if (!hasValidShape) {
    return { ok: false, slug, code: 'SLUG_INVALID_FORMAT' };
  }

  if (isReservedSlug(slug)) {
    return { ok: false, slug, code: 'SLUG_RESERVED' };
  }

  return { ok: true, slug };
}
