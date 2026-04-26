import type {
  CreateGymRequest,
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
  UpdateGymRequest,
  UpdateMemberRequest,
  UpdatePlanRequest,
} from '@gym-app/shared/types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
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
  getPublicGym: (slug: string) =>
    request<PublicGymResponse>(`/public/gyms/${encodeURIComponent(slug)}`),
};
