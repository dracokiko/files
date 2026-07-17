import { useState, useEffect, useMemo } from 'react';
import { getSubjectsForUser } from '../data/subjects';
import {
  loadDailyStats,
  saveDailyStats,
  calculateLevel,
  getLevelName,
  getLisbonToday,
} from '../utils/progress';
import { fetchBulkProgress } from '../api/gamification';
import type { UserProfile, Subject, Plan } from '../types';
import type { DailyStats, StreakData } from '../types/progress';
import SubjectDashboard from './subject/SubjectDashboard';
import UpsellPopup from './UpsellPopup';
import XPBar from './progress/XPBar';
import StreakBadge from './progress/StreakBadge';
import TeamPage from '../pages/TeamPage';
import SettingsPage from '../pages/SettingsPage';
import GreekBackground from './GreekBackground';

type DashboardView = 'subjects' | 'team' | 'settings';

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onUserUpdated: (profile: UserProfile) => void;
  initialView?: DashboardView;
}

function isPaidPlan(plan: Plan): boolean {
  return plan === 'essential' || plan === 'team';
}

const PLAN_LABEL: Record<Plan, string> = {
  free:      'Plano Grátis',
  essential: 'Versão Essential',
  team:      'Versão Team',
};

const PLAN_COLOR: Record<Plan, string> = {
  free:      'bg-gray-100 text-gray-600',
  essential: 'bg-blue-100 text-blue-700',
  team:      'bg-violet-100 text-violet-700',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDailySubjectId(daily: DailyStats): string | null {
  if (daily.date !== getLisbonToday()) return null;
  return daily.selectedSubjectId;
}

// ─── Subject card ─────────────────────────────────────────────────────────────

function SubjectCard({
  subject,
  isSelected,
  subjectXP,
  quizUnlocked,
  isPaid,
  onClick,
}: {
  subject: Subject;
  isSelected: boolean;
  subjectXP: number;
  quizUnlocked: boolean;
  isPaid: boolean;
  onClick: () => void;
}) {
  const level = calculateLevel(subjectXP);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150 group ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Level badge */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-xs font-black">{level}</span>
        </div>

        {/* Name */}
        <span className={`text-sm font-medium flex-1 ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
          {subject.name}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {subject.isOptional && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Optativa
            </span>
          )}
          {quizUnlocked || isPaid ? (
            <span title="Quiz disponível" className="text-emerald-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </span>
          ) : (
            <span title="Quiz bloqueado" className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
          )}
          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {subjectXP > 0 && (
        <div className="mt-2 ml-10">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-violet-400 rounded-full"
              style={{ width: `${(subjectXP % 100)}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Semester section ─────────────────────────────────────────────────────────

function SemesterSection({
  semesterLabel,
  subjects,
  dailySubjectId,
  subjectProgressMap,
  quizUnlocked,
  isPaid,
  onSelect,
}: {
  semesterLabel: string;
  subjects: Subject[];
  dailySubjectId: string | null;
  subjectProgressMap: Record<string, number>;
  quizUnlocked: boolean;
  isPaid: boolean;
  onSelect: (subject: Subject) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{semesterLabel}</h3>
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-300">{subjects.length} cadeiras</span>
      </div>
      <div className="space-y-2">
        {subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            isSelected={dailySubjectId === subject.id}
            subjectXP={subjectProgressMap[subject.id] ?? 0}
            quizUnlocked={quizUnlocked}
            isPaid={isPaid}
            onClick={() => onSelect(subject)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ user, onLogout, onUserUpdated, initialView = 'subjects' }: DashboardProps) {
  const [view, setView] = useState<DashboardView>(initialView);
  const [dailyStats, setDailyStats] = useState<DailyStats>(() => loadDailyStats());
  const [openedSubject, setOpenedSubject] = useState<Subject | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [globalXP, setGlobalXP] = useState(0);
  const [streak, setStreak] = useState<StreakData>({ current: 0, lastActiveDate: '' });
  const [subjectXPMap, setSubjectXPMap] = useState<Record<string, number>>({});

  const paid = isPaidPlan(user.plan);
  const dailySubjectId = getDailySubjectId(dailyStats);
  const globalLevel = calculateLevel(globalXP);

  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  useEffect(() => {
    let cancelled = false;
    getSubjectsForUser(user.institution, user.courseId, user.course, user.year)
      .then((subjects) => { if (!cancelled) setAllSubjects(subjects); })
      .catch(() => { if (!cancelled) setAllSubjects([]); });
    return () => { cancelled = true; };
  }, [user.institution, user.courseId, user.course, user.year]);

  // Refetch whenever the subject list changes or the student returns from a
  // subject's detail view (where XP may have changed via a completed quiz).
  useEffect(() => {
    if (openedSubject || !allSubjects.length) return;
    let cancelled = false;
    fetchBulkProgress(allSubjects.map((s) => s.id))
      .then((data) => {
        if (cancelled) return;
        setGlobalXP(data.globalXP);
        setStreak(data.streak);
        setSubjectXPMap(data.subjectXP);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [allSubjects, openedSubject]);

  const bySemester = useMemo(() => {
    const map = new Map<number, { label: string; subjects: Subject[] }>();
    for (const s of allSubjects) {
      if (!map.has(s.semester)) map.set(s.semester, { label: s.semesterLabel, subjects: [] });
      map.get(s.semester)!.subjects.push(s);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v);
  }, [allSubjects]);

  const subjectProgressMap = subjectXPMap;

  function handleSelectSubject(subject: Subject) {
    if (paid) {
      // Paid: open directly
      setOpenedSubject(subject);
      return;
    }

    // Free plan: 1 subject per day
    if (dailySubjectId === subject.id) {
      // Already selected today — open it
      setOpenedSubject(subject);
      return;
    }

    if (dailySubjectId !== null) {
      // Already selected a different subject today
      setShowUpsell(true);
      return;
    }

    // First selection of the day
    const newStats: DailyStats = {
      ...dailyStats,
      date: getLisbonToday(),
      selectedSubjectId: subject.id,
    };
    saveDailyStats(newStats);
    setDailyStats(newStats);
    setOpenedSubject(subject);
  }

  function handleDailyStatsUpdate(updated: DailyStats) {
    saveDailyStats(updated);
    setDailyStats(updated);
  }

  // ── Team view ──────────────────────────────────────────────────────────────
  if (view === 'team') {
    return <TeamPage onBack={() => setView('subjects')} />;
  }

  // ── Settings view ─────────────────────────────────────────────────────────
  if (view === 'settings') {
    return <SettingsPage user={user} onBack={() => setView('subjects')} onUserUpdated={onUserUpdated} />;
  }

  // ── Subject dashboard view ────────────────────────────────────────────────
  if (openedSubject) {
    return (
      <div className="relative isolate min-h-screen bg-gray-50">
        <GreekBackground />
        {/* Minimal top bar */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/logo-mark.png" alt="" className="w-7 h-7 object-contain" />
            <span className="font-black text-gray-900 text-sm">Kepos</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLOR[user.plan]}`}>
              {PLAN_LABEL[user.plan]}
            </span>
            <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Sair
            </button>
          </div>
        </div>

        <SubjectDashboard
          subject={openedSubject}
          user={user}
          dailyStats={dailyStats}
          onBack={() => setOpenedSubject(null)}
          onDailyStatsUpdate={handleDailyStatsUpdate}
        />
      </div>
    );
  }

  // ── Subject list view ─────────────────────────────────────────────────────
  return (
    <>
      <div className="relative isolate min-h-screen bg-gray-50">
        <GreekBackground />
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/images/logo-mark.png" alt="" className="w-8 h-8 object-contain flex-shrink-0" />
              <div className="hidden sm:block">
                <p className="text-xs text-gray-400 leading-none">{user.institution} · {user.course}</p>
                <p className="text-sm font-bold text-gray-900 leading-tight">{user.yearLabel}</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 flex-1 max-w-xs">
              <div className="flex-1">
                <XPBar xp={globalXP} showLabel={false} compact />
              </div>
              <div className="flex-shrink-0 text-xs font-semibold text-gray-500">
                Nv.{globalLevel} · {getLevelName(globalLevel)}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StreakBadge streak={streak.current} compact />
              <span className={`hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLOR[user.plan]}`}>
                {PLAN_LABEL[user.plan]}
              </span>
              {user.plan === 'team' && (
                <button
                  onClick={() => setView('team')}
                  aria-label="Equipa"
                  title="Equipa"
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 3c0-1.657-3.582-3-8-3s-8 1.343-8 3v2h16v-2z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setView('settings')}
                aria-label="Definições"
                title="Definições"
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-semibold text-blue-700 hidden sm:block">{user.name.split(' ')[0]}</span>
              </div>
              <button onClick={onLogout} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

          {/* Free plan banner */}
          {!paid && dailySubjectId && (
            <div className="bg-gradient-to-r from-blue-500 to-violet-500 rounded-2xl p-5 text-white flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Cadeira de hoje</p>
                <p className="text-sm font-bold">
                  {allSubjects.find((s) => s.id === dailySubjectId)?.name ?? 'Selecionada'}
                </p>
              </div>
              <button
                onClick={() => {
                  const subject = allSubjects.find((s) => s.id === dailySubjectId);
                  if (subject) setOpenedSubject(subject);
                }}
                className="ml-auto text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-colors"
              >
                Abrir →
              </button>
            </div>
          )}

          {/* Subject panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Cadeiras</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Plano oficial organizado por ano e semestre.</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${PLAN_COLOR[user.plan]}`}>
                  {PLAN_LABEL[user.plan]}
                </span>
              </div>

              {!paid && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {dailySubjectId
                      ? 'Cadeira selecionada para hoje. Faz upgrade para aceder a todas.'
                      : 'Seleciona uma cadeira para estudar hoje. Clica para abrir o tutor.'}
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 py-5 space-y-7">
              {bySemester.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Estamos a preparar as cadeiras para este ano.
                </p>
              ) : (
                bySemester.map(({ label, subjects }) => (
                  <SemesterSection
                    key={label}
                    semesterLabel={label}
                    subjects={subjects}
                    dailySubjectId={paid ? null : dailySubjectId}
                    subjectProgressMap={subjectProgressMap}
                    quizUnlocked={paid}
                    isPaid={paid}
                    onSelect={handleSelectSubject}
                  />
                ))
              )}
            </div>

            {/* Legend */}
            <div className="px-6 pb-5 flex flex-wrap items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Quiz desbloqueado
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Quiz bloqueado
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Optativa</span>
                Cadeira optativa
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center leading-relaxed px-4">
            A disponibilidade de materiais, correções e critérios específicos depende da cadeira e da recolha de fontes.
          </p>

          {!paid && (
            <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-6 border border-blue-100 text-center">
              <p className="text-sm font-bold text-gray-900 mb-1">Queres subir de nível a sério?</p>
              <p className="text-xs text-gray-500 mb-4">
                Desbloqueia quizzes, capítulos, buddies e XP ilimitado.
              </p>
              <button
                onClick={() => setShowUpsell(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01] transition-all duration-200"
              >
                Ver planos
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {showUpsell && <UpsellPopup onClose={() => setShowUpsell(false)} />}
    </>
  );
}
