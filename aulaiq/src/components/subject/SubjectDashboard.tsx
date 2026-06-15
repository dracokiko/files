import { useState } from 'react';
import type { Subject } from '../../types';
import type { UserProgress, DailyStats } from '../../types/progress';
import type { Chapter } from '../../data/chapters';
import { getChaptersForSubject, getDemoQuizQuestions } from '../../data/chapters';
import { calculateLevel, calculateMastery, updateXPAfterQuizAttempt, saveProgress } from '../../utils/progress';
import type { UserProfile } from '../../types';
import LevelBadge from '../progress/LevelBadge';
import XPBar from '../progress/XPBar';
import MasteryProgress from '../progress/MasteryProgress';
import StreakBadge from '../progress/StreakBadge';
import TutorIA from './TutorIA';
import ChaptersTab from './ChaptersTab';
import QuizView from './QuizView';
import ProgressTab from './ProgressTab';
import BuddiesTab from './BuddiesTab';
import UpsellPopup from '../UpsellPopup';

type Tab = 'tutor' | 'chapters' | 'quizzes' | 'progress' | 'buddies';

interface SubjectDashboardProps {
  subject: Subject;
  user: UserProfile;
  progress: UserProgress;
  dailyStats: DailyStats;
  onBack: () => void;
  onProgressUpdate: (updated: UserProgress) => void;
  onDailyStatsUpdate: (updated: DailyStats) => void;
}

export default function SubjectDashboard({
  subject,
  user,
  progress,
  dailyStats,
  onBack,
  onProgressUpdate,
  onDailyStatsUpdate,
}: SubjectDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('tutor');
  const [activeQuizChapter, setActiveQuizChapter] = useState<Chapter | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  const isPaid = user.plan !== 'free';
  const subjectProgress = progress.subjectProgress[subject.id];
  const subjectXP = subjectProgress?.xp ?? 0;
  const subjectLevel = calculateLevel(subjectXP);
  const mastery = calculateMastery(
    subjectProgress?.correctAnswers ?? 0,
    (subjectProgress?.totalAnswers ?? 0) - (subjectProgress?.correctAnswers ?? 0),
  );

  const chapters = getChaptersForSubject(subject.id);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'tutor', label: 'Tutor IA' },
    { id: 'chapters', label: 'Capítulos' },
    { id: 'quizzes', label: 'Quizzes' },
    { id: 'progress', label: 'Progresso' },
    { id: 'buddies', label: 'Buddies' },
  ];

  function handleTabClick(tab: Tab) {
    if (tab === 'quizzes' && !isPaid) {
      setShowUpsell(true);
      return;
    }
    setActiveTab(tab);
    setActiveQuizChapter(null);
  }

  function handleStartQuiz(chapter: Chapter) {
    if (!isPaid) { setShowUpsell(true); return; }
    setActiveQuizChapter(chapter);
    setActiveTab('quizzes');
  }

  function handleQuizComplete(correctAnswers: number, firstTryCorrect: boolean[]) {
    if (!activeQuizChapter) return;
    const { updated } = updateXPAfterQuizAttempt({
      progress,
      subjectId: subject.id,
      chapterId: activeQuizChapter.id,
      correctAnswers,
      totalQuestions: 5,
      firstTryCorrect,
    });
    saveProgress(updated);
    onProgressUpdate(updated);
  }

  // ── If in an active quiz ────────────────────────────────────────────────
  if (activeQuizChapter && activeTab === 'quizzes') {
    const questions = getDemoQuizQuestions(activeQuizChapter.name, subject.name);
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Mini header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setActiveQuizChapter(null)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-xs text-gray-400">{subject.name}</p>
            <p className="text-sm font-bold text-gray-900">{activeQuizChapter.name}</p>
          </div>
        </div>
        <QuizView
          subject={subject}
          chapter={activeQuizChapter}
          questions={questions}
          onComplete={handleQuizComplete}
          onBack={() => setActiveQuizChapter(null)}
          onOpenTutor={() => { setActiveQuizChapter(null); setActiveTab('tutor'); }}
        />
      </div>
    );
  }

  // ── Main subject dashboard ────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0 sticky top-0 z-10">
        {/* Back + subject name */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 truncate">
              {subject.course} · {subject.yearLabel} · {subject.semesterLabel}
            </p>
            <h1 className="text-base font-black text-gray-900 truncate">{subject.name}</h1>
          </div>
          <LevelBadge level={subjectLevel} size="sm" />
        </div>

        {/* XP + mastery strip */}
        <div className="flex items-center gap-4 pb-3 px-1">
          <div className="flex-1">
            <XPBar xp={subjectXP} showLabel={false} compact />
          </div>
          <div className="flex-1">
            <MasteryProgress mastery={mastery} size="sm" />
          </div>
          <StreakBadge streak={progress.streak.current} compact />
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-100 -mx-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              } ${tab.id === 'quizzes' && !isPaid ? 'opacity-50' : ''}`}
            >
              {tab.label}
              {tab.id === 'quizzes' && !isPaid && (
                <span className="ml-1">🔒</span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-5">
        {activeTab === 'tutor' && (
          <TutorIA
            subject={subject}
            isPaid={isPaid}
            dailyStats={dailyStats}
            onDailyStatsUpdate={onDailyStatsUpdate}
          />
        )}

        {activeTab === 'chapters' && (
          <ChaptersTab
            subject={subject}
            chapters={chapters}
            subjectProgress={subjectProgress}
            isPaid={isPaid}
            onStartQuiz={handleStartQuiz}
          />
        )}

        {activeTab === 'quizzes' && isPaid && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Seleciona um capítulo para iniciar o quiz:
            </p>
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => handleStartQuiz(chapter)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm text-left transition-all group"
              >
                <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                  {chapter.name}
                </span>
                <span className="text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  Iniciar →
                </span>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'progress' && (
          <ProgressTab subject={subject} chapters={chapters} progress={progress} />
        )}

        {activeTab === 'buddies' && (
          <BuddiesTab
            subject={subject}
            userXP={subjectXP}
            userName={user.name.split(' ')[0]}
            progress={progress}
            onProgressUpdate={onProgressUpdate}
          />
        )}
      </div>

      {showUpsell && <UpsellPopup onClose={() => setShowUpsell(false)} />}
    </div>
  );
}
