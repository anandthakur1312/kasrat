import type { FastifyRequest } from 'fastify';
import { createClerkClient, verifyToken } from '@clerk/backend';
import type { Owner as DbOwner, Gym as DbGym } from '@prisma/client';
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
 * Returns the authenticated owner and their gym. Throws 404 with a
 * `code: 'NO_GYM'` hint if the owner hasn't completed setup yet — the
 * frontend uses this to redirect to /setup.
 */
export async function getOwnerGym(req: FastifyRequest): Promise<{
  owner: DbOwner;
  gym: DbGym;
}> {
  const owner = await getAuthenticatedOwner(req);
  const gym = await prisma.gym.findFirst({ where: { ownerId: owner.id } });
  if (!gym) {
    throw Object.assign(new Error('No gym configured'), {
      statusCode: 404,
      code: 'NO_GYM',
    });
  }
  return { owner, gym };
}
