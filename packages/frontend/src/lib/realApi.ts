import type {
  AccessResponse,
  AcceptInviteRequest,
  AcceptInviteResponse,
  CreateGymRequest,
  CreateInviteRequest,
  CreateInviteResponse,
  CreateMemberRequest,
  CreatePlanRequest,
  Gym,
  Member,
  MemberDetailResponse,
  MembersListResponse,
  Payment,
  Plan,
  PublicGymResponse,
  RecordPaymentRequest,
  SlugCheckResponse,
  TeamResponse,
  UpdateGymRequest,
  UpdateMemberRequest,
  UpdatePlanRequest,
  UpdateTeamMemberRequest,
} from '@gym-app/shared/types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

// Public payment page (`/public/gyms/:slug`) doesn't need a token.
// Invite acceptance does need a token (the accepting user must be signed in)
// — only the public gym page is truly public.
const PUBLIC_PREFIXES = ['/public/'];

// Wired up at app boot from a hook (`useAuth().getToken`) — see
// components/clerk-token-bridge.tsx. Until then, requests fall back to
// no-auth (which only works for /public/* and /health).
let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  const token = !isPublic && getTokenFn ? await getTokenFn() : null;
  const headers = new Headers(init?.headers);
  if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // not JSON — keep body empty
    }
    throw new ApiError(
      body.error ?? `${res.status} ${res.statusText}`,
      res.status,
      body.code,
    );
  }
  return res.json() as Promise<T>;
}

export const realApi = {
  getMembersList: () => request<MembersListResponse>('/members'),
  getMemberDetail: (id: string) => request<MemberDetailResponse>(`/members/${encodeURIComponent(id)}`),
  createMember: (req: CreateMemberRequest) =>
    request<Member>('/members', { method: 'POST', body: JSON.stringify(req) }),
  updateMember: (id: string, req: UpdateMemberRequest) =>
    request<Member>(`/members/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    }),
  deleteMember: (id: string) =>
    request<{ ok: true }>(`/members/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => undefined),
  recordPayment: (req: RecordPaymentRequest) =>
    request<Payment>('/payments', { method: 'POST', body: JSON.stringify(req) }),
  getPlans: () => request<Plan[]>('/plans'),
  createPlan: (req: CreatePlanRequest) =>
    request<Plan>('/plans', { method: 'POST', body: JSON.stringify(req) }),
  updatePlan: (id: string, req: UpdatePlanRequest) =>
    request<Plan>(`/plans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    }),
  getGym: () => request<Gym>('/gym'),
  updateGym: (req: UpdateGymRequest) =>
    request<Gym>('/gym', { method: 'PATCH', body: JSON.stringify(req) }),
  createGym: (req: CreateGymRequest) =>
    request<Gym>('/gyms', { method: 'POST', body: JSON.stringify(req) }),
  checkSlug: (slug: string) =>
    request<SlugCheckResponse>(`/public/slugs/check?slug=${encodeURIComponent(slug)}`),
  getPublicGym: (slug: string) =>
    request<PublicGymResponse>(`/public/gyms/${encodeURIComponent(slug)}`),
  // Issue #16
  getMyAccess: () => request<AccessResponse>('/me/access'),
  getTeam: (gymId: string) =>
    request<TeamResponse>(`/gyms/${encodeURIComponent(gymId)}/team`),
  updateTeamMember: (gymId: string, ownerId: string, req: UpdateTeamMemberRequest) =>
    request<TeamResponse>(
      `/gyms/${encodeURIComponent(gymId)}/team/${encodeURIComponent(ownerId)}`,
      { method: 'PATCH', body: JSON.stringify(req) },
    ),
  createInvite: (gymId: string, req: CreateInviteRequest) =>
    request<CreateInviteResponse>(
      `/gyms/${encodeURIComponent(gymId)}/invites`,
      { method: 'POST', body: JSON.stringify(req) },
    ),
  revokeInvite: (gymId: string, inviteId: string) =>
    request<{ ok: true }>(
      `/gyms/${encodeURIComponent(gymId)}/invites/${encodeURIComponent(inviteId)}`,
      { method: 'DELETE' },
    ).then(() => undefined),
  acceptInvite: (req: AcceptInviteRequest) =>
    request<AcceptInviteResponse>('/invites/accept', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
};
