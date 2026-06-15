export interface ChapterProgress {
  xp: number;
  correctAnswers: number;
  wrongAnswers: number;
  quizAttempts: QuizAttemptRecord[];
}

export interface SubjectProgress {
  xp: number;
  correctAnswers: number;
  totalAnswers: number;
  chapters: Record<string, ChapterProgress>;
}

export interface QuizAttemptRecord {
  date: string;
  score: number;
  totalQuestions: number;
  xpGained: number;
  isPerfect: boolean;
}

export type BadgeId =
  | 'first_quiz'
  | 'xp_100_subject'
  | 'chapter_mastered'
  | 'perfect_quiz'
  | 'streak_3'
  | 'passed_buddy'
  | 'recovered_weak_chapter';

export interface BadgeInfo {
  id: BadgeId;
  name: string;
  description: string;
  emoji: string;
}

export interface Buddy {
  id: string;
  name: string;
  totalXP: number;
  subjectXP: Record<string, number>;
  strongestSubject: string;
  weakChapter: string;
}

export interface StreakData {
  current: number;
  lastActiveDate: string; // YYYY-MM-DD Europe/Lisbon
}

export interface UserProgress {
  globalXP: number;
  subjectProgress: Record<string, SubjectProgress>;
  earnedBadges: BadgeId[];
  streak: StreakData;
  competitiveMode: boolean;
  buddies: Buddy[];
}

export interface DailyStats {
  date: string; // YYYY-MM-DD Europe/Lisbon
  messageCount: number;
  selectedSubjectId: string | null;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
