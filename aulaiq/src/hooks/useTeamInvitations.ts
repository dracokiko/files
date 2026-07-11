import { useCallback, useEffect, useState } from 'react';
import type { TeamInvitation } from '../types/team';
import * as teamApi from '../services/teamApi';

export function useTeamInvitations(enabled: boolean) {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setInvitations(await teamApi.fetchPendingInvitations());
    } catch {
      setError('Não foi possível carregar os convites.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  const invite = useCallback(async (email: string) => {
    const result = await teamApi.inviteMember(email);
    setInvitations((prev) => [result.invitation, ...prev]);
    return result;
  }, []);

  const resend = useCallback(async (id: string) => {
    const result = await teamApi.resendInvitation(id);
    setInvitations((prev) => [result.invitation, ...prev.filter((i) => i.id !== id)]);
    return result;
  }, []);

  const cancel = useCallback(async (id: string) => {
    await teamApi.cancelInvitation(id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { invitations, loading, error, refresh, invite, resend, cancel };
}
