import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

export type ProfileErrorCode = 'COURSE_CHANGE_LOCKED' | 'INVALID_INPUT' | 'NO_STRIPE_CUSTOMER'
  | 'INTERNAL_ERROR' | 'UNKNOWN_ERROR';

export class ProfileApiError extends Error {
  code: ProfileErrorCode;
  status: number;
  availableAt?: string | null;
  constructor(code: ProfileErrorCode, message: string, status: number, availableAt?: string | null) {
    super(message);
    this.code = code;
    this.status = status;
    this.availableAt = availableAt ?? null;
  }
}

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
    const code: ProfileErrorCode = data.error ?? 'UNKNOWN_ERROR';
    throw new ProfileApiError(code, data.message ?? 'Algo correu mal.', res.status, data.availableAt);
  }
  return data as T;
}

interface ProfileResponse {
  profile: UserProfile;
  courseChange?: { eligible: boolean; availableAt: string | null };
}

export async function fetchMyProfile(): Promise<ProfileResponse> {
  const res = await authFetch('/api/profile');
  return parseOrThrow<ProfileResponse>(res);
}

export interface CourseChangePayload {
  institutionId: string;
  institutionName: string;
  courseId: string;
  courseName: string;
  year: number;
  yearLabel: string;
}

export async function updateCourse(payload: CourseChangePayload): Promise<UserProfile> {
  const res = await authFetch('/api/profile/course', { method: 'PATCH', body: JSON.stringify(payload) });
  const data = await parseOrThrow<{ profile: UserProfile }>(res);
  return data.profile;
}

// ── Billing (Stripe portal for a personal, non-team account) ──────────────
export async function openPersonalBillingPortal(returnUrl: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('billing-portal', { body: { returnUrl } });
  if (error) {
    let code: ProfileErrorCode = 'UNKNOWN_ERROR';
    try {
      const body = await (error as { context?: Response }).context?.json?.();
      if (body?.error) code = body.error;
    } catch {
      // Response body wasn't JSON — fall back to the generic error below.
    }
    if (code === 'NO_STRIPE_CUSTOMER') {
      throw new ProfileApiError(code, 'Ainda não tens uma subscrição paga associada à tua conta.', 409);
    }
    throw new ProfileApiError(code, 'Não foi possível abrir a gestão de pagamento.', 500);
  }
  if (!data?.url) {
    throw new ProfileApiError('UNKNOWN_ERROR', 'Não foi possível abrir a gestão de pagamento.', 500);
  }
  return data.url as string;
}
