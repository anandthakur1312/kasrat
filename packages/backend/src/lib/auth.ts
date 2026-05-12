import type { FastifyRequest } from 'fastify';
import { createClerkClient, verifyToken } from '@clerk/backend';
import type {
  Gym as DbGym,
  GymUser as DbGymUser,
  Owner as DbOwner,
} from '@prisma/client';
import { prisma } from '../db.js';
import { newId } from './ids.js';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

let clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!clerk) {
    if (!CLERK_SECRET_KEY) {
      throw Object.assign(new Error('CLERK_SECRET_KEY is not configured on the server'), {
        statusCode: 500,
      });
    }
    clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  }
  return clerk;
}

export interface AuthedClaims {
  sub: string; // clerk user id
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthedClaims;
  }
}

export type GymRole = 'admin' | 'staff';

export interface GymAccess {
  owner: DbOwner;
  gym: DbGym;
  membership: DbGymUser;
}

/**
 * preHandler that verifies the Bearer JWT issued by Clerk on the frontend
 * and attaches { sub: clerkUserId } to req.auth. Throws 401 on missing /
 * malformed / expired tokens.
 */
export async function clerkAuth(req: FastifyRequest): Promise<void> {
  if (!CLERK_SECRET_KEY) {
    throw Object.assign(new Error('CLERK_SECRET_KEY is not configured on the server'), {
      statusCode: 500,
    });
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    if (!payload.sub) throw new Error('token missing sub');
    req.auth = { sub: payload.sub };
  } catch {
    throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 });
  }
}

/**
 * Returns the Owner row for the authenticated Clerk user, creating it
 * lazily on first sight (JIT). Owner.id stays internal (`owner-xxx`);
 * clerkUserId is the bridge to Clerk.
 */
export async function getAuthenticatedOwner(req: FastifyRequest): Promise<DbOwner> {
  if (!req.auth) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  const clerkUserId = req.auth.sub;
  const existing = await prisma.owner.findUnique({ where: { clerkUserId } });
  if (existing) return existing;

  // First time we've seen this Clerk user — fetch their profile and create
  // the Owner row. This is the only Clerk API call we make per user, ever.
  const clerkUser = await getClerk().users.getUser(clerkUserId);
  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${clerkUserId}@kasrat.local`;
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'Owner';

  return prisma.owner.create({
    data: {
      id: newId('owner'),
      clerkUserId,
      email: primaryEmail,
      name: fullName,
    },
  });
}

/**
 * Resolves the gym the request should operate on. Looks up active GymUser
 * rows for the caller:
 *
 *  - 0 rows  → 403 NO_GYM_ACCESS
 *  - 1 row   → that gym
 *  - 2+ rows → use X-Gym-Id header if provided; otherwise 409 MULTIPLE_GYMS
 *
 * Replaces the old getOwnerGym() which read Gym.ownerId directly.
 */
export async function getGymAccess(req: FastifyRequest): Promise<GymAccess> {
  const owner = await getAuthenticatedOwner(req);
  const memberships = await prisma.gymUser.findMany({
    where: { ownerId: owner.id, status: 'active' },
    include: { gym: true },
  });
  if (memberships.length === 0) {
    throw Object.assign(new Error('No gym access yet'), {
      statusCode: 403,
      code: 'NO_GYM_ACCESS',
    });
  }

  const headerGymId = req.headers['x-gym-id'];
  const requestedGymId = Array.isArray(headerGymId) ? headerGymId[0] : headerGymId;

  let chosen: (typeof memberships)[number] | undefined;
  if (requestedGymId) {
    chosen = memberships.find((m) => m.gymId === requestedGymId);
    if (!chosen) {
      throw Object.assign(new Error('Gym access not found'), {
        statusCode: 403,
        code: 'NO_GYM_ACCESS',
      });
    }
  } else if (memberships.length === 1) {
    chosen = memberships[0]!;
  } else {
    throw Object.assign(new Error('Multiple gyms — select one via X-Gym-Id'), {
      statusCode: 409,
      code: 'MULTIPLE_GYMS',
    });
  }

  if (chosen.gym.status !== 'active') {
    throw Object.assign(new Error('Gym is not active'), {
      statusCode: 403,
      code: 'GYM_NOT_ACTIVE',
    });
  }

  const { gym, ...rest } = chosen;
  return { owner, gym, membership: { ...rest, gymId: gym.id } };
}

/**
 * Wraps getGymAccess and enforces that the caller's role is in `allowed`.
 * Throws 403 FORBIDDEN_ROLE otherwise. Backend role enforcement is the
 * source of truth — UI hiding alone is not enough.
 */
export async function requireGymRole(
  req: FastifyRequest,
  allowed: GymRole[],
): Promise<GymAccess> {
  const access = await getGymAccess(req);
  if (!allowed.includes(access.membership.role as GymRole)) {
    throw Object.assign(new Error('You do not have permission to perform this action'), {
      statusCode: 403,
      code: 'FORBIDDEN_ROLE',
    });
  }
  return access;
}

/**
 * Asserts the authenticated user is a platform admin (Kasrat team member).
 * Used to gate gym creation, access-request review, and other ops outside
 * any single gym's scope.
 */
export async function requirePlatformAdmin(req: FastifyRequest): Promise<DbOwner> {
  const owner = await getAuthenticatedOwner(req);
  if (!owner.isPlatformAdmin) {
    throw Object.assign(new Error('Platform admin required'), {
      statusCode: 403,
      code: 'NOT_PLATFORM_ADMIN',
    });
  }
  return owner;
}
