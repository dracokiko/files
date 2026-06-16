// TODO: In production, XP, quiz attempts and leaderboard must be validated server-side to prevent cheating.

import type {
  UserProgress,
  DailyStats,
  SubjectProgress,
  ChapterProgress,
  BadgeId,
  BadgeInfo,
  StreakData,
} from '../types/progress';

const PROGRESS_KEY = 'studylab_progress';
const DAILY_KEY = 'studylab_daily';

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

const DEFAULT_STREAK: StreakData = { current: 0, lastActiveDate: '' };

const DEFAULT_PROGRESS: UserProgress = {
  globalXP: 0,
  subjectProgress: {},
  earnedBadges: [],
  streak: DEFAULT_STREAK,
  competitiveMode: false,
  buddies: [
    {
      id: 'miguel',
      name: 'Miguel',
      totalXP: 590,
      subjectXP: { 'g-y1-s1-micro': 210, 'g-y1-s1-mat1': 180, 'eco-y1-s1-micro': 200 },
      strongestSubject: 'Microeconomia',
      weakChapter: 'Elasticidades',
    },
    {
      id: 'ines',
      name: 'Inês',
      totalXP: 720,
      subjectXP: { 'g-y1-s1-micro': 280, 'g-y1-s1-mat1': 240, 'eco-y1-s1-micro': 270 },
      strongestSubject: 'Microeconomia',
      weakChapter: 'Integrais',
    },
    {
      id: 'joao',
      name: 'João',
      totalXP: 410,
      subjectXP: { 'g-y1-s1-micro': 150, 'g-y1-s1-mat1': 120, 'eco-y1-s1-micro': 140 },
      strongestSubject: 'Matemática I',
      weakChapter: 'Estruturas de Mercado',
    },
  ],
};

export function loadProgress(): UserProgress {
  return safeParseLocalStorage<UserProgress>(PROGRESS_KEY, DEFAULT_PROGRESS);
}

export function saveProgress(progress: UserProgress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

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

export interface XPResult {
  xpDelta: number;
  completionXP: number;
  perfectBonus: number;
  streakBonus: number;
  newBadges: BadgeId[];
  newGlobalXP: number;
  newSubjectXP: number;
  newChapterXP: number;
  isPerfect: boolean;
}

export function updateXPAfterQuizAttempt(params: {
  progress: UserProgress;
  subjectId: string;
  chapterId: string;
  correctAnswers: number;
  totalQuestions: number;
  firstTryCorrect: boolean[];
}): { updated: UserProgress; result: XPResult } {
  const { progress, subjectId, chapterId, correctAnswers, totalQuestions, firstTryCorrect } = params;
  const today = getLisbonToday();

  // Per-answer XP
  let xpDelta = 0;
  for (let i = 0; i < totalQuestions; i++) {
    if (i < correctAnswers) {
      xpDelta += firstTryCorrect[i] ? 25 : 15;
    } else {
      xpDelta = Math.max(0, xpDelta - 5);
    }
  }

  // Completion bonus
  const completionXP = 40;
  xpDelta += completionXP;

  // Perfect bonus
  const isPerfect = correctAnswers === totalQuestions;
  const perfectBonus = isPerfect ? 100 : 0;
  xpDelta += perfectBonus;

  // Streak
  let streakBonus = 0;
  const streak = { ...progress.streak };
  if (streak.lastActiveDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(yesterday);
    streak.current = streak.lastActiveDate === yStr ? streak.current + 1 : 1;
    streak.lastActiveDate = today;
    streakBonus = 20;
    xpDelta += streakBonus;
  }

  // Update subject/chapter progress
  const prevSubject: SubjectProgress = progress.subjectProgress[subjectId] ?? {
    xp: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    chapters: {},
  };
  const prevChapter: ChapterProgress = prevSubject.chapters[chapterId] ?? {
    xp: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    quizAttempts: [],
  };

  const chapterXP = Math.max(0, prevChapter.xp + xpDelta);
  const wrongAnswers = totalQuestions - correctAnswers;

  const newChapter: ChapterProgress = {
    xp: chapterXP,
    correctAnswers: prevChapter.correctAnswers + correctAnswers,
    wrongAnswers: prevChapter.wrongAnswers + wrongAnswers,
    quizAttempts: [
      ...prevChapter.quizAttempts,
      { date: today, score: correctAnswers, totalQuestions, xpGained: xpDelta, isPerfect },
    ],
  };

  const newSubjectXP = Math.max(0, prevSubject.xp + xpDelta);
  const newSubject: SubjectProgress = {
    xp: newSubjectXP,
    correctAnswers: prevSubject.correctAnswers + correctAnswers,
    totalAnswers: prevSubject.totalAnswers + totalQuestions,
    chapters: { ...prevSubject.chapters, [chapterId]: newChapter },
  };

  const newGlobalXP = Math.max(0, progress.globalXP + xpDelta);

  // Badges
  const earned = new Set<BadgeId>(progress.earnedBadges);
  const newBadges: BadgeId[] = [];
  const addBadge = (id: BadgeId) => {
    if (!earned.has(id)) {
      earned.add(id);
      newBadges.push(id);
    }
  };

  if (newChapter.quizAttempts.length === 1) addBadge('first_quiz');
  if (isPerfect) addBadge('perfect_quiz');
  if (newSubjectXP >= 100) addBadge('xp_100_subject');
  if (streak.current >= 3) addBadge('streak_3');
  const chapterMastery = calculateMastery(newChapter.correctAnswers, newChapter.wrongAnswers);
  if (chapterMastery >= 80) addBadge('chapter_mastered');
  if (prevChapter.wrongAnswers > prevChapter.correctAnswers && newChapter.correctAnswers > newChapter.wrongAnswers) {
    addBadge('recovered_weak_chapter');
  }

  const updated: UserProgress = {
    globalXP: newGlobalXP,
    subjectProgress: { ...progress.subjectProgress, [subjectId]: newSubject },
    earnedBadges: Array.from(earned),
    streak,
    buddies: progress.buddies,
    competitiveMode: progress.competitiveMode,
  };

  return {
    updated,
    result: {
      xpDelta,
      completionXP,
      perfectBonus,
      streakBonus,
      newBadges,
      newGlobalXP,
      newSubjectXP,
      newChapterXP: chapterXP,
      isPerfect,
    },
  };
}
