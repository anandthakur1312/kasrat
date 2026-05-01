import { describe, expect, it } from 'vitest';
import { slugifySlugInput, validateSlug } from './slug.js';

describe('gym slug validation', () => {
  it('accepts valid public URL slugs', () => {
    expect(validateSlug('gungun-fitness-2')).toEqual({
      ok: true,
      slug: 'gungun-fitness-2',
    });
  });

  it('normalizes whitespace and case before validating', () => {
    expect(validateSlug('  Gungun  ')).toEqual({
      ok: true,
      slug: 'gungun',
    });
  });

  it('rejects reserved app routes', () => {
    expect(validateSlug('settings')).toEqual({
      ok: false,
      slug: 'settings',
      code: 'SLUG_RESERVED',
    });
  });

  it('rejects malformed slugs', () => {
    expect(validateSlug('a')).toEqual({
      ok: false,
      slug: 'a',
      code: 'SLUG_INVALID_FORMAT',
    });
    expect(validateSlug('-gungun')).toEqual({
      ok: false,
      slug: '-gungun',
      code: 'SLUG_INVALID_FORMAT',
    });
    expect(validateSlug('gungun--fitness')).toEqual({
      ok: false,
      slug: 'gungun--fitness',
      code: 'SLUG_INVALID_FORMAT',
    });
  });

  it('slugifies owner input for setup and settings fields', () => {
    expect(slugifySlugInput('Gungun Fitness Club')).toBe('gungun-fitness-club');
  });
});
