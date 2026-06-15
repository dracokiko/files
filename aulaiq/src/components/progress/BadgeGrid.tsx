import { ALL_BADGES } from '../../utils/progress';
import type { BadgeId } from '../../types/progress';

interface BadgeGridProps {
  earned: BadgeId[];
}

export default function BadgeGrid({ earned }: BadgeGridProps) {
  const earnedSet = new Set(earned);
  return (
    <div className="grid grid-cols-2 gap-3">
      {ALL_BADGES.map((badge) => {
        const unlocked = earnedSet.has(badge.id);
        return (
          <div
            key={badge.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              unlocked
                ? 'border-blue-100 bg-blue-50'
                : 'border-gray-100 bg-gray-50 opacity-50'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
              unlocked ? 'bg-white shadow-sm' : 'bg-gray-100'
            }`}>
              {unlocked ? badge.emoji : '🔒'}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold leading-tight ${unlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                {badge.name}
              </p>
              <p className="text-xs text-gray-400 leading-tight truncate">{badge.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
