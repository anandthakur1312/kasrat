// Pure helpers for the access-mutation safety rules. Extracted so the
// "last admin" invariant is unit-testable without Prisma.

export type GymUserSummary = {
  ownerId: string;
  role: 'admin' | 'staff';
  status: 'active' | 'disabled';
};

export type AccessChange =
  | { kind: 'changeRole'; targetOwnerId: string; newRole: 'admin' | 'staff' }
  | { kind: 'disable'; targetOwnerId: string };

export type AccessCheck =
  | { ok: true }
  | { ok: false; code: 'LAST_ADMIN' | 'NOT_FOUND' | 'NO_OP' };

/**
 * Rejects mutations that would drop a gym to zero active admins. Disabling
 * the only admin, demoting them to staff, or removing the row entirely is
 * blocked. Platform-admin recovery is the only path out of zero-admin state.
 */
export function checkAccessChange(
  members: GymUserSummary[],
  change: AccessChange,
): AccessCheck {
  const target = members.find((m) => m.ownerId === change.targetOwnerId);
  if (!target) return { ok: false, code: 'NOT_FOUND' };

  const activeAdmins = members.filter((m) => m.role === 'admin' && m.status === 'active');
  const targetIsLastActiveAdmin =
    target.role === 'admin' &&
    target.status === 'active' &&
    activeAdmins.length === 1;

  if (change.kind === 'changeRole') {
    if (target.role === change.newRole) return { ok: false, code: 'NO_OP' };
    if (change.newRole === 'staff' && targetIsLastActiveAdmin) {
      return { ok: false, code: 'LAST_ADMIN' };
    }
    return { ok: true };
  }

  // disable
  if (target.status === 'disabled') return { ok: false, code: 'NO_OP' };
  if (targetIsLastActiveAdmin) return { ok: false, code: 'LAST_ADMIN' };
  return { ok: true };
}
