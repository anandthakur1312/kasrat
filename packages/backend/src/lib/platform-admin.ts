// Issue #16: env-var allowlist for platform-admin emails. Set
// PLATFORM_ADMIN_EMAILS to a comma-separated list, e.g.
//   PLATFORM_ADMIN_EMAILS=anand@example.com,ops@example.com
// MVP only — replace with a DB-backed PlatformAdmin table once we have
// more than a couple of admins or need an audit trail.

function parseAllowlist(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdmin(email: string): boolean {
  return parseAllowlist().has(email.trim().toLowerCase());
}
