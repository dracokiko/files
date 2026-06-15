import type { Subject } from '../../types';
import type { UserProgress } from '../../types/progress';
import type { Chapter } from '../../data/chapters';
import { calculateLevel, calculateMastery } from '../../utils/progress';
import XPBar from '../progress/XPBar';
import MasteryProgress from '../progress/MasteryProgress';
import StreakBadge from '../progress/StreakBadge';
import BadgeGrid from '../progress/BadgeGrid';
import LevelBadge from '../progress/LevelBadge';

interface ProgressTabProps {
  subject: Subject;
  chapters: Chapter[];
  progress: UserProgress;
}

export default function ProgressTab({ subject, chapters, progress }: ProgressTabProps) {
  const subjectProgress = progress.subjectProgress[subject.id];
  const subjectXP = subjectProgress?.xp ?? 0;
  const subjectLevel = calculateLevel(subjectXP);
  const subjectMastery = calculateMastery(
    subjectProgress?.correctAnswers ?? 0,
    (subjectProgress?.totalAnswers ?? 0) - (subjectProgress?.correctAnswers ?? 0),
  );

  return (
    <div className="space-y-6">
      {/* Global stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-gray-400 font-medium mb-1">XP Global</p>
          <p className="text-2xl font-black text-blue-600">{progress.globalXP}</p>
          <p className="text-xs text-gray-400 mt-0.5">Nível {calculateLevel(progress.globalXP)} global</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-gray-400 font-medium mb-1">Streak</p>
          <StreakBadge streak={progress.streak.current} />
          <p className="text-xs text-gray-400 mt-1">
            {progress.streak.current > 0 ? `${progress.streak.current} dia(s) seguidos` : 'Começa hoje!'}
          </p>
        </div>
      </div>

      {/* Subject stats */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{subject.name}</h3>
            <p className="text-xs text-gray-400">{subjectXP} XP nesta cadeira</p>
          </div>
          <LevelBadge level={subjectLevel} size="md" />
        </div>
        <XPBar xp={subjectXP} />
        <MasteryProgress mastery={subjectMastery} />
      </div>

      {/* Chapter breakdown */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Progresso por capítulo
        </h3>
        <div className="space-y-2">
          {chapters.map((chapter) => {
            const cp = subjectProgress?.chapters[chapter.id];
            const cXP = cp?.xp ?? 0;
            const mastery = calculateMastery(cp?.correctAnswers ?? 0, cp?.wrongAnswers ?? 0);
            const attempts = cp?.quizAttempts.length ?? 0;
            return (
              <div key={chapter.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">{calculateLevel(cXP)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold text-gray-800 truncate">{chapter.name}</p>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{attempts}x</span>
                  </div>
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        mastery >= 70 ? 'bg-emerald-500' : mastery >= 40 ? 'bg-amber-400' : 'bg-blue-400'
                      }`}
                      style={{ width: `${Math.max(mastery, cXP > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ${
                  mastery >= 70 ? 'text-emerald-600' : mastery >= 40 ? 'text-amber-500' : 'text-gray-400'
                }`}>
                  {mastery}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Conquistas</h3>
        <BadgeGrid earned={progress.earnedBadges} />
      </div>
    </div>
  );
}
