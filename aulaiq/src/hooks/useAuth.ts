import { useState, useCallback } from 'react';
import type { UserProfile } from '../types';
import { getProfile, saveProfile, clearProfile, demoLogin } from '../utils/auth';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(() => getProfile());

  const login = useCallback((email: string, _password: string): boolean => {
    // TODO: Production — POST /api/auth/login, receive JWT, store in httpOnly cookie
    const profile = demoLogin(email);
    if (profile) {
      setUser(profile);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    // TODO: Production — invalidate server session / call supabase.auth.signOut()
    clearProfile();
    setUser(null);
  }, []);

  const register = useCallback((profile: UserProfile) => {
    saveProfile(profile);
    setUser(profile);
  }, []);

  return { user, login, logout, register };
}
