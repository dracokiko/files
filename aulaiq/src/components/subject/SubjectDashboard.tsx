import { useState, useEffect, useCallback } from 'react';
import type { Subject } from '../../types';
import type { DailyStats, SubjectProgress, StreakData, BadgeId } from '../../types/progress';
import type { Chapter } from '../../data/chapters';
import { fetchChaptersForSubject } from '../../data/chapters';
import { calculateLevel, calculateMastery } from '../../utils/progress';
import { fetchSubjectProgress } from '../../api/gamification';
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
  dailyStats: DailyStats;
  onBack: () => void;
  onDailyStatsUpdate: (updated: DailyStats) => void;
}

const EMPTY_SUBJECT_PROGRESS: SubjectProgress = { xp: 0, correctAnswers: 0, totalAnswers: 0, chapters: {} };

export default function SubjectDashboard({
  subject,
  user,
  dailyStats,
  onBack,
  onDailyStatsUpdate,
}: SubjectDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('tutor');
  const [activeQuizChapter, setActiveQuizChapter] = useState<Chapter | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [hasMaterial, setHasMaterial] = useState(false);
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress>(EMPTY_SUBJECT_PROGRESS);
  const [streak, setStreak] = useState<StreakData>({ current: 0, lastActiveDate: '' });
  const [earnedBadges, setEarnedBadges] = useState<BadgeId[]>([]);
  const [globalXP, setGlobalXP] = useState(0);

  const isPaid = user.plan !== 'free';
  const subjectXP = subjectProgress.xp;
  const subjectLevel = calculateLevel(subjectXP);
  const mastery = calculateMastery(
    subjectProgress.correctAnswers,
    subjectProgress.totalAnswers - subjectProgress.correctAnswers,
  );

  useEffect(() => {
    fetchChaptersForSubject(subject.id)
      .then(({ chapters, hasMaterial }) => { setChapters(chapters); setHasMaterial(hasMaterial); })
      .catch(() => { setChapters([]); setHasMaterial(false); });
  }, [subject.id]);

  const reloadProgress = useCallback(() => {
    fetchSubjectProgress(subject.id)
      .then((data) => {
        setSubjectProgress(data.subjectProgress);
        setStreak(data.streak);
        setEarnedBadges(data.earnedBadges);
        setGlobalXP(data.globalXP);
      })
      .catch(() => {});
  }, [subject.id]);

  useEffect(() => { reloadProgress(); }, [reloadProgress]);

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

  function handleQuizComplete() {
    // Server already applied the XP/badges — just re-sync local state.
    reloadProgress();
  }

  // ── If in an active quiz ────────────────────────────────────────────────
  if (activeQuizChapter && activeTab === 'quizzes') {
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
          <StreakBadge streak={streak.current} compact />
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
          !hasMaterial ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Ainda não há capítulos disponíveis para esta cadeira.
            </p>
          ) : (
            <ChaptersTab
              subject={subject}
              chapters={chapters}
              subjectProgress={subjectProgress}
              isPaid={isPaid}
              onStartQuiz={handleStartQuiz}
            />
          )
        )}

        {activeTab === 'quizzes' && isPaid && (
          !hasMaterial ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Ainda não há material para gerar quizzes nesta cadeira.
            </p>
          ) : (
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
          )
        )}

        {activeTab === 'progress' && (
          <ProgressTab
            subject={subject}
            chapters={chapters}
            globalXP={globalXP}
            streak={streak}
            earnedBadges={earnedBadges}
            subjectProgress={subjectProgress}
          />
        )}

        {activeTab === 'buddies' && (
          <BuddiesTab
            subject={subject}
            currentUser={user}
            subjectXP={subjectXP}
          />
        )}
      </div>

      {showUpsell && <UpsellPopup onClose={() => setShowUpsell(false)} />}
    </div>
  );
}
