import { useEffect, useState, useCallback } from 'react';
import type { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { fetchProfile, signIn, signOut } from '../utils/auth';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

  return { user, login, logout, register, loading };
}
