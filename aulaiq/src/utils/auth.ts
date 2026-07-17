import { supabase } from '../lib/supabase';
import type { UserProfile, StudyPreferences } from '../types';

export async function signUp(params: {
  name: string;
  email: string;
  password: string;
  institutionId: string;
  institutionName: string;
  courseId: string;
  courseName: string;
  year: number;
  yearLabel: string;
  preferences: StudyPreferences;
}): Promise<{ user: UserProfile | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: { data: { name: params.name } },
  });

  if (error || !data.user) {
    return { user: null, error: error?.message ?? 'Erro ao criar conta.' };
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    name: params.name,
    email: params.email.toLowerCase(),
    institution: params.institutionName,
    institution_id: params.institutionId,
    course: params.courseName,
    course_id: params.courseId,
    year: params.year,
    year_label: params.yearLabel,
    plan: 'free',
    preferences: params.preferences,
  });

  if (profileError) {
    return { user: null, error: profileError.message };
  }

  return {
    user: {
      id: data.user.id,
      name: params.name,
      email: params.email.toLowerCase(),
      institution: params.institutionName,
      institutionId: params.institutionId,
      course: params.courseName,
      courseId: params.courseId,
      year: params.year,
      yearLabel: params.yearLabel,
      plan: 'free',
      preferences: params.preferences,
      createdAt: new Date().toISOString(),
      courseChangedAt: null,
      demoSessionActive: false,
    },
    error: null,
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: UserProfile | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { user: null, error: 'Email ou password incorretos.' };
  }

  const profile = await fetchProfile(data.user.id);
  return { user: profile, error: profile ? null : 'Perfil não encontrado.' };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  return { error: error?.message ?? null };
}

export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    institution: data.institution,
    institutionId: data.institution_id,
    course: data.course,
    courseId: data.course_id,
    year: data.year,
    yearLabel: data.year_label,
    plan: data.plan,
    preferences: data.preferences,
    createdAt: data.created_at,
    courseChangedAt: data.course_changed_at ?? null,
    demoSessionActive: false,
  };
}

export function getStudyPlanSuggestion(preferences: StudyPreferences): {
  rhythm: string;
  plan: string;
} {
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
    plan: goalMap[preferences.mainGoal] ?? 'Plano personalizado gerado pelo Kepos.',
  };
}
