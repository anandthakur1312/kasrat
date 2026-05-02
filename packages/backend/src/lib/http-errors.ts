import { ZodError } from 'zod';

interface ErrorLike {
  message?: string;
  statusCode?: number;
  code?: string;
}

interface ErrorResponse {
  status: number;
  body: {
    error: string;
    code?: string;
  };
  shouldLog: boolean;
}

function asErrorLike(err: unknown): ErrorLike {
  return typeof err === 'object' && err !== null ? (err as ErrorLike) : {};
}

function isDatabaseUnavailable(err: unknown): boolean {
  const message = asErrorLike(err).message ?? '';
  return (
    message.includes("Can't reach database server") ||
    message.includes('Authentication failed against database server') ||
    message.includes('Timed out fetching a new connection from the connection pool')
  );
}

export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: 'Invalid request.',
        code: 'VALIDATION_ERROR',
      },
      shouldLog: false,
    };
  }

  if (isDatabaseUnavailable(err)) {
    return {
      status: 503,
      body: {
        error: 'Database is unavailable. Check DATABASE_URL and database connectivity.',
        code: 'DATABASE_UNAVAILABLE',
      },
      shouldLog: true,
    };
  }

  const error = asErrorLike(err);
  const status = error.statusCode ?? 500;
  if (status >= 500) {
    return {
      status,
      body: { error: 'Internal server error' },
      shouldLog: true,
    };
  }

  return {
    status,
    body: {
      error: error.message ?? 'Request failed',
      ...(error.code ? { code: error.code } : {}),
    },
    shouldLog: false,
  };
}
