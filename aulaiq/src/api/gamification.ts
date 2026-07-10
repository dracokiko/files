import { supabase } from '../lib/supabase';
import type { SubjectProgress, ChapterProgress, BadgeId, StreakData } from '../types/progress';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()), ...(init?.headers ?? {}) };
  return fetch(path, { ...init, headers });
}

interface ProgressResponse {
  globalXP: number;
  streak: StreakData;
  earnedBadges: BadgeId[];
  subject: { xp: number; correct_answers: number; total_answers: number };
  chapters: Record<string, { xp: number; correct_answers: number; wrong_answers: number; attempts_count: number }>;
}

// Maps the server's snake_case gamification response into the existing
// client-side UserProgress shape, so ChaptersTab/ProgressTab/etc. need no
// changes — only where the data comes from changes (server, not localStorage).
export async function fetchSubjectProgress(cadeiraId: string): Promise<{
  globalXP: number; streak: StreakData; earnedBadges: BadgeId[]; subjectProgress: SubjectProgress;
}> {
  const res = await authFetch(`/api/gamification/progress?cadeira_id=${encodeURIComponent(cadeiraId)}`);
  if (!res.ok) throw new Error('Erro ao carregar progresso.');
  const data: ProgressResponse = await res.json();

  const chapters: Record<string, ChapterProgress> = {};
  for (const [chapterId, c] of Object.entries(data.chapters)) {
    chapters[chapterId] = {
      xp: c.xp,
      correctAnswers: c.correct_answers,
      wrongAnswers: c.wrong_answers,
      quizAttempts: Array(c.attempts_count).fill({ date: '', score: 0, totalQuestions: 0, xpGained: 0, isPerfect: false }),
    };
  }

  return {
    globalXP: data.globalXP,
    streak: data.streak,
    earnedBadges: data.earnedBadges,
    subjectProgress: {
      xp: data.subject.xp,
      correctAnswers: data.subject.correct_answers,
      totalAnswers: data.subject.total_answers,
      chapters,
    },
  };
}

export async function fetchBulkProgress(cadeiraIds: string[]): Promise<{
  globalXP: number; streak: StreakData; subjectXP: Record<string, number>;
}> {
  if (!cadeiraIds.length) return { globalXP: 0, streak: { current: 0, lastActiveDate: '' }, subjectXP: {} };
  const res = await authFetch(`/api/gamification/progress/bulk?cadeira_ids=${cadeiraIds.map(encodeURIComponent).join(',')}`);
  if (!res.ok) throw new Error('Erro ao carregar progresso.');
  return res.json();
}

export interface RemoteBuddy { id: string; name: string; xp: number }
export interface RemoteChallenge { id: string; fromName: string; message: string | null; createdAt: string }

export async function fetchBuddies(cadeiraId: string): Promise<{ buddies: RemoteBuddy[]; challenges: RemoteChallenge[] }> {
  const res = await authFetch(`/api/gamification/buddies?cadeira_id=${encodeURIComponent(cadeiraId)}`);
  if (!res.ok) throw new Error('Erro ao carregar buddies.');
  return res.json();
}

export async function addBuddy(email: string): Promise<{ id: string; name: string }> {
  const res = await authFetch('/api/gamification/buddies', { method: 'POST', body: JSON.stringify({ email }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erro ao adicionar buddy.');
  return data;
}

export async function sendChallenge(buddyUserId: string, cadeiraId: string, message?: string): Promise<void> {
  const res = await authFetch('/api/gamification/challenges', {
    method: 'POST',
    body: JSON.stringify({ buddy_user_id: buddyUserId, cadeira_id: cadeiraId, message }),
  });
  if (!res.ok) throw new Error('Erro ao enviar desafio.');
}

export async function markChallengeSeen(challengeId: string): Promise<void> {
  await authFetch(`/api/gamification/challenges/${challengeId}/seen`, { method: 'POST' });
}

export interface RemoteQuizQuestion { id: string; ordinal: number; question: string; options: string[] }

export async function generateQuiz(cadeiraId: string, chapterId: string): Promise<{ quizSetId: string; questions: RemoteQuizQuestion[] }> {
  const res = await authFetch('/api/gamification/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ cadeira_id: cadeiraId, chapter_id: chapterId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar quiz.');
  return { quizSetId: data.quiz_set_id, questions: data.questions };
}

export async function answerQuizQuestion(quizSetId: string, ordinal: number, selected: number): Promise<{
  correct: boolean; correctIndex: number; explanation: string;
}> {
  const res = await authFetch(`/api/gamification/quiz/${quizSetId}/answer`, {
    method: 'POST', body: JSON.stringify({ ordinal, selected }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erro ao submeter resposta.');
  return { correct: data.correct, correctIndex: data.correct_index, explanation: data.explanation };
}

export interface QuizCompleteResult {
  correctAnswers: number; totalQuestions: number; isPerfect: boolean;
  xpGained: number; newGlobalXP: number; newSubjectXP: number; newChapterXP: number; newBadges: BadgeId[];
}

export async function completeQuiz(quizSetId: string): Promise<QuizCompleteResult> {
  const res = await authFetch(`/api/gamification/quiz/${quizSetId}/complete`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erro ao concluir quiz.');
  return data;
}
