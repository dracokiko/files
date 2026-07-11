import { useCallback, useEffect, useState } from 'react';
import type { TeamMember } from '../types/team';
import * as teamApi from '../services/teamApi';

export function useTeamMembers(enabled: boolean) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setMembers(await teamApi.fetchTeamMembers());
    } catch {
      setError('Não foi possível carregar os membros.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (memberId: string) => {
    await teamApi.removeMember(memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }, []);

  return { members, loading, error, refresh, remove };
}
