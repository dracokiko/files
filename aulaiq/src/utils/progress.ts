import type { DailyStats, BadgeInfo } from '../types/progress';

const DAILY_KEY = 'studylab_daily';
const COMPETITIVE_KEY = 'studylab_competitive';

export function safeParseLocalStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function getLisbonToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}

export function calculateLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function calculateMastery(correctAnswers: number, wrongAnswers: number): number {
  const total = correctAnswers + wrongAnswers;
  if (total === 0) return 0;
  return Math.round((correctAnswers / total) * 100);
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'Caloiro perdido',
  2: 'A apanhar o fio',
  3: 'Já não dói tanto',
  4: 'Sabe o que está a fazer',
  5: 'Frequência mode',
  6: 'Perigoso na revisão',
  7: 'Tutor informal',
};

export function getLevelName(level: number): string {
  return LEVEL_NAMES[level] ?? 'Máquina da cadeira';
}

export const ALL_BADGES: BadgeInfo[] = [
  { id: 'first_quiz', name: 'Primeiro Quiz', description: 'Completaste o teu primeiro quiz', emoji: '🎯' },
  { id: 'xp_100_subject', name: '100 XP numa cadeira', description: 'Atingiste 100 XP numa cadeira', emoji: '⭐' },
  { id: 'chapter_mastered', name: 'Capítulo Dominado', description: '80%+ de mastery num capítulo', emoji: '🏆' },
  { id: 'perfect_quiz', name: 'Quiz Perfeito', description: '5/5 num quiz', emoji: '💯' },
  { id: 'streak_3', name: '3 dias seguidos', description: 'Estudaste 3 dias seguidos', emoji: '🔥' },
  { id: 'passed_buddy', name: 'Passaste um buddy', description: 'Ultrapassaste um amigo no ranking', emoji: '🥇' },
  { id: 'recovered_weak_chapter', name: 'Recuperaste um capítulo fraco', description: 'Melhoraste um capítulo com menos de 40% mastery', emoji: '💪' },
];

export function loadDailyStats(): DailyStats {
  const today = getLisbonToday();
  const stored = safeParseLocalStorage<DailyStats>(DAILY_KEY, {
    date: today,
    messageCount: 0,
    selectedSubjectId: null,
  });
  if (stored.date !== today) {
    return { date: today, messageCount: 0, selectedSubjectId: null };
  }
  return stored;
}

export function saveDailyStats(stats: DailyStats): void {
  localStorage.setItem(DAILY_KEY, JSON.stringify(stats));
}

// Competitive mode is a cosmetic tone toggle for buddy messaging, not a
// gamified stat — local-only is fine, nothing to cheat.
export function loadCompetitiveMode(): boolean {
  return safeParseLocalStorage<boolean>(COMPETITIVE_KEY, false);
}

export function saveCompetitiveMode(value: boolean): void {
  localStorage.setItem(COMPETITIVE_KEY, JSON.stringify(value));
}
