import { supabase } from '../lib/supabase';
import type {
  Team, TeamMember, TeamInvitation, MyPendingInvitation, InvitationLookup, TeamErrorCode,
} from '../types/team';
import { TeamApiError } from '../types/team';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()), ...(init?.headers ?? {}) };
  return fetch(path, { ...init, headers });
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code: TeamErrorCode = data.error ?? 'UNKNOWN_ERROR';
    throw new TeamApiError(code, data.message ?? 'Algo correu mal.', res.status);
  }
  return data as T;
}

export async function fetchMyTeam(): Promise<Team | null> {
  const res = await authFetch('/api/team');
  const data = await parseOrThrow<{ team: Team | null }>(res);
  return data.team;
}

export async function fetchMyPendingInvitation(): Promise<MyPendingInvitation | null> {
  const res = await authFetch('/api/team/my-invitation');
  const data = await parseOrThrow<{ invitation: MyPendingInvitation | null }>(res);
  return data.invitation;
}

export async function acceptMyInvitation(): Promise<{ teamId: string; teamName: string }> {
  const res = await authFetch('/api/team/my-invitation/accept', { method: 'POST' });
  return parseOrThrow(res);
}

export async function declineMyInvitation(): Promise<void> {
  const res = await authFetch('/api/team/my-invitation/decline', { method: 'POST' });
  await parseOrThrow(res);
}

export async function renameTeam(name: string): Promise<Team> {
  const res = await authFetch('/api/team', { method: 'PATCH', body: JSON.stringify({ name }) });
  const data = await parseOrThrow<{ team: Team }>(res);
  return data.team;
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await authFetch('/api/team/members');
  const data = await parseOrThrow<{ members: TeamMember[] }>(res);
  return data.members;
}

export async function removeMember(memberId: string): Promise<void> {
  const res = await authFetch(`/api/team/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
  await parseOrThrow(res);
}

export async function leaveTeam(): Promise<void> {
  const res = await authFetch('/api/team/leave', { method: 'POST' });
  await parseOrThrow(res);
}

export async function fetchPendingInvitations(): Promise<TeamInvitation[]> {
  const res = await authFetch('/api/team/invitations');
  const data = await parseOrThrow<{ invitations: TeamInvitation[] }>(res);
  return data.invitations;
}

export async function inviteMember(email: string): Promise<{ invitation: TeamInvitation; emailSent: boolean }> {
  const res = await authFetch('/api/team/invitations', { method: 'POST', body: JSON.stringify({ email }) });
  return parseOrThrow(res);
}

export async function resendInvitation(id: string): Promise<{ invitation: TeamInvitation; emailSent: boolean }> {
  const res = await authFetch(`/api/team/invitations/${encodeURIComponent(id)}/resend`, { method: 'POST' });
  return parseOrThrow(res);
}

export async function cancelInvitation(id: string): Promise<void> {
  const res = await authFetch(`/api/team/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await parseOrThrow(res);
}

// ── Invitation acceptance page ────────────────────────────────────────────

export async function lookupInvitation(token: string): Promise<InvitationLookup> {
  const res = await fetch(`/api/team/invitations/token/${encodeURIComponent(token)}`);
  return parseOrThrow(res);
}

export async function acceptInvitation(token: string): Promise<{ teamId: string; teamName: string }> {
  const res = await authFetch(`/api/team/invitations/token/${encodeURIComponent(token)}/accept`, { method: 'POST' });
  return parseOrThrow(res);
}

export async function declineInvitation(token: string): Promise<void> {
  const res = await authFetch(`/api/team/invitations/token/${encodeURIComponent(token)}/decline`, { method: 'POST' });
  await parseOrThrow(res);
}

// ── Billing (Stripe portal) — calls the edge function directly, same
// pattern OnboardingModal already uses for create-checkout. ────────────────

export async function openBillingPortal(returnUrl: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('team-billing-portal', {
    body: { returnUrl },
  });
  if (error || !data?.url) {
    throw new TeamApiError('UNKNOWN_ERROR', 'Não foi possível abrir a gestão de subscrição.', 500);
  }
  return data.url as string;
}
