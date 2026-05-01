type Env = {
  [key: string]: string | undefined;
  CORS_ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
};

const DEFAULT_PRODUCTION_ORIGINS = [
  'https://kasrat.pages.dev',
  'https://kasrat.in',
  'https://www.kasrat.in',
];

function configuredOrigins(env: Env): Set<string> {
  return new Set(
    (env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  const url = parseOrigin(origin);
  if (!url) return false;
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
  );
}

function isKasratPagesOrigin(origin: string): boolean {
  const url = parseOrigin(origin);
  if (!url || url.protocol !== 'https:') return false;
  return url.hostname === 'kasrat.pages.dev' || url.hostname.endsWith('.kasrat.pages.dev');
}

export function isCorsOriginAllowed(origin: string | undefined, env: Env = process.env): boolean {
  if (!origin) return true;

  if (configuredOrigins(env).has(origin)) return true;

  if (DEFAULT_PRODUCTION_ORIGINS.includes(origin)) return true;
  if (isKasratPagesOrigin(origin)) return true;

  if (env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) return true;

  return false;
}

export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, origin: boolean) => void,
): void {
  callback(null, isCorsOriginAllowed(origin));
}
