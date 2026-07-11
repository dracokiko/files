import { useCallback, useEffect, useState } from 'react';
import type { Team, MyPendingInvitation } from '../types/team';
import * as teamApi from '../services/teamApi';

/**
 * Team + "do I have a pending invite" state. Cheap enough to call from
 * anywhere that needs to decide whether to show the "Equipa" nav entry
 * (Dashboard) as well as from TeamPage itself — member/invitation lists are
 * fetched separately (useTeamMembers/useTeamInvitations) so this stays light.
 */
export function useTeam() {
  const [team, setTeam] = useState<Team | null>(null);
  const [myInvitation, setMyInvitation] = useState<MyPendingInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedTeam = await teamApi.fetchMyTeam();
      setTeam(fetchedTeam);
      if (!fetchedTeam) {
        setMyInvitation(await teamApi.fetchMyPendingInvitation());
      } else {
        setMyInvitation(null);
      }
    } catch {
      setError('Não foi possível carregar a equipa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const rename = useCallback(async (name: string) => {
    const updated = await teamApi.renameTeam(name);
    setTeam(updated);
    return updated;
  }, []);

  const leave = useCallback(async () => {
    await teamApi.leaveTeam();
    setTeam(null);
  }, []);

  return { team, myInvitation, loading, error, refresh, rename, leave };
}
