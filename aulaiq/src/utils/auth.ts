import type { UserProfile, StudyPreferences, Plan } from '../types';

// TODO: Production security — NEVER store passwords in localStorage (or anywhere client-side).
// Passwords must be hashed server-side with bcrypt or argon2.
// Replace this entire module with one of:
//   • Supabase Auth: supabase.auth.signUp/signIn/signOut
//   • Firebase Auth: createUserWithEmailAndPassword / signInWithEmailAndPassword
//   • Clerk: useSignUp / useSignIn hooks
//   • Auth.js (NextAuth): next-auth providers
// The client should only ever hold a short-lived JWT / session cookie, never credentials.

const PROFILE_KEY = 'aulaiq_demo_profile';

export function saveProfile(profile: UserProfile): void {
  // TODO: Replace with POST /api/auth/register → persist to user database
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getProfile(): UserProfile | null {
  const stored = localStorage.getItem(PROFILE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserProfile;
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  // TODO: Replace with Supabase/Firebase signOut() — invalidate server-side session
  localStorage.removeItem(PROFILE_KEY);
}

export function demoLogin(email: string): UserProfile | null {
  // TODO: Production — POST /api/auth/login with { email, password }
  // Server compares bcrypt hash and returns a signed JWT.
  // NEVER compare passwords client-side.
  const profile = getProfile();
  if (profile && profile.email.toLowerCase() === email.toLowerCase()) {
    return { ...profile, demoSessionActive: true };
  }
  return null;
}

export function createDemoProfile(params: {
  name: string;
  email: string;
  institutionId: string;
  institutionName: string;
  courseId: string;
  courseName: string;
  year: number;
  yearLabel: string;
  plan?: Plan;
  preferences: StudyPreferences;
}): UserProfile {
  const profile: UserProfile = {
    name: params.name,
    email: params.email,
    institution: params.institutionName,
    institutionId: params.institutionId,
    course: params.courseName,
    courseId: params.courseId,
    year: params.year,
    yearLabel: params.yearLabel,
    plan: params.plan ?? 'free',
    preferences: params.preferences,
    createdAt: new Date().toISOString(),
    demoSessionActive: true,
  };
  saveProfile(profile);
  return profile;
}

export function getStudyPlanSuggestion(preferences: StudyPreferences): {
  rhythm: string;
  plan: string;
} {
  // TODO: Backend integration — POST /api/study-plan/generate
  // Send { institutionId, courseId, preferences } → AI generates personalized plan
  const frequencyMap: Record<string, string> = {
    '1-2': 'Sessões longas e focadas. Recomendamos 2 blocos de 2h com revisão espaçada.',
    '3-4': 'Ótima frequência! Distribui os temas ao longo da semana com quizzes diários.',
    '5+': 'Estudo intensivo — usa quizzes diários e revisão espaçada por tema.',
  };
  const goalMap: Record<string, string> = {
    'Passar à cadeira': 'Foco nos tópicos de maior peso nos exames anteriores.',
    'Melhorar média': 'Cobertura completa com aprofundamento nos temas-chave.',
    'Preparar exame': 'Modo exame: simulações, correções e revisão rápida.',
    'Estudar com menos stress': 'Plano gradual com check-ins diários e pausas planeadas.',
  };
  return {
    rhythm: frequencyMap[preferences.studyFrequency] ?? 'Plano adaptado ao teu ritmo.',
    plan: goalMap[preferences.mainGoal] ?? 'Plano personalizado gerado pelo AulaIQ.',
  };
}
