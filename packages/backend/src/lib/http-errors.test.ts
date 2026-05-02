import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toErrorResponse } from './http-errors.js';

describe('toErrorResponse', () => {
  it('sanitizes database connectivity failures', () => {
    const response = toErrorResponse(
      new Error(
        "Invalid prisma call: Can't reach database server at `example.neon.tech:5432`",
      ),
    );

    expect(response).toEqual({
      status: 503,
      body: {
        error: 'Database is unavailable. Check DATABASE_URL and database connectivity.',
        code: 'DATABASE_UNAVAILABLE',
      },
      shouldLog: true,
    });
  });

  it('preserves expected client-facing errors', () => {
    const response = toErrorResponse(
      Object.assign(new Error('No gym configured'), {
        statusCode: 404,
        code: 'NO_GYM',
      }),
    );

    expect(response).toEqual({
      status: 404,
      body: { error: 'No gym configured', code: 'NO_GYM' },
      shouldLog: false,
    });
  });

  it('returns validation failures as client errors', () => {
    const result = z.object({ name: z.string().min(1) }).safeParse({ name: '' });
    if (result.success) throw new Error('expected schema parse to fail');

    expect(toErrorResponse(result.error)).toEqual({
      status: 400,
      body: { error: 'Invalid request.', code: 'VALIDATION_ERROR' },
      shouldLog: false,
    });
  });

  it('hides unexpected server error details', () => {
    const response = toErrorResponse(new Error('/local/path leaked'));

    expect(response).toEqual({
      status: 500,
      body: { error: 'Internal server error' },
      shouldLog: true,
    });
  });
});
