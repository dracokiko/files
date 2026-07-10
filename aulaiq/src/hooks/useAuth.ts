import { useEffect, useState, useCallback } from 'react';
import type { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { fetchProfile, signIn, signOut } from '../utils/auth';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Supabase signs the user in with a temporary session when they click
      // the password-reset link — intercept it and ask for a new password
      // instead of dropping them straight into the dashboard.
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        return;
      }

      if (session?.user) {
        let profile = await fetchProfile(session.user.id);
        if (!profile) {
          // Profile insert may still be in flight right after signUp — retry once
          await new Promise((r) => setTimeout(r, 700));
          profile = await fetchProfile(session.user.id);
        }
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { user: profile, error } = await signIn(email, password);
    if (profile) setUser(profile);
    return !error;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  const register = useCallback((profile: UserProfile) => {
    setUser(profile);
  }, []);

  const finishRecovery = useCallback(async () => {
    setRecoveryMode(false);
    await signOut();
    setUser(null);
  }, []);

  return { user, login, logout, register, loading, recoveryMode, finishRecovery };
}
