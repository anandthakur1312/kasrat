import { describe, expect, it } from 'vitest';
import { checkAccessChange, type GymUserSummary } from './gym-access.js';

const adminA: GymUserSummary = { ownerId: 'a', role: 'admin', status: 'active' };
const adminB: GymUserSummary = { ownerId: 'b', role: 'admin', status: 'active' };
const staffC: GymUserSummary = { ownerId: 'c', role: 'staff', status: 'active' };
const disabledAdmin: GymUserSummary = { ownerId: 'd', role: 'admin', status: 'disabled' };

describe('checkAccessChange', () => {
  it('rejects demoting the only active admin', () => {
    expect(
      checkAccessChange([adminA], { kind: 'changeRole', targetOwnerId: 'a', newRole: 'staff' }),
    ).toEqual({ ok: false, code: 'LAST_ADMIN' });
  });

  it('rejects disabling the only active admin', () => {
    expect(checkAccessChange([adminA], { kind: 'disable', targetOwnerId: 'a' })).toEqual({
      ok: false,
      code: 'LAST_ADMIN',
    });
  });

  it('treats a disabled admin as not counting toward the active-admin floor', () => {
    expect(
      checkAccessChange([adminA, disabledAdmin], {
        kind: 'changeRole',
        targetOwnerId: 'a',
        newRole: 'staff',
      }),
    ).toEqual({ ok: false, code: 'LAST_ADMIN' });
  });

  it('allows demoting an admin when another active admin exists', () => {
    expect(
      checkAccessChange([adminA, adminB], {
        kind: 'changeRole',
        targetOwnerId: 'a',
        newRole: 'staff',
      }),
    ).toEqual({ ok: true });
  });

  it('allows disabling an admin when another active admin exists', () => {
    expect(
      checkAccessChange([adminA, adminB], { kind: 'disable', targetOwnerId: 'b' }),
    ).toEqual({ ok: true });
  });

  it('allows disabling staff regardless of admin count', () => {
    expect(
      checkAccessChange([adminA, staffC], { kind: 'disable', targetOwnerId: 'c' }),
    ).toEqual({ ok: true });
  });

  it('reports NOT_FOUND when target is not a member', () => {
    expect(
      checkAccessChange([adminA], { kind: 'disable', targetOwnerId: 'missing' }),
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('reports NO_OP when role change matches current role', () => {
    expect(
      checkAccessChange([adminA, adminB], {
        kind: 'changeRole',
        targetOwnerId: 'a',
        newRole: 'admin',
      }),
    ).toEqual({ ok: false, code: 'NO_OP' });
  });

  it('reports NO_OP when disabling an already-disabled member', () => {
    expect(
      checkAccessChange([adminA, disabledAdmin], { kind: 'disable', targetOwnerId: 'd' }),
    ).toEqual({ ok: false, code: 'NO_OP' });
  });

  it('allows promoting staff to admin', () => {
    expect(
      checkAccessChange([adminA, staffC], {
        kind: 'changeRole',
        targetOwnerId: 'c',
        newRole: 'admin',
      }),
    ).toEqual({ ok: true });
  });
});
