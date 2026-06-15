interface StreakBadgeProps {
  streak: number;
  compact?: boolean;
}

export default function StreakBadge({ streak, compact = false }: StreakBadgeProps) {
  if (streak === 0) {
    return compact ? null : (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span>🔥</span>
        <span>Sem streak</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'bg-orange-50 rounded-xl px-3 py-1.5'}`}>
      <span className="text-base">🔥</span>
      <span className={`font-bold text-orange-500 ${compact ? 'text-xs' : 'text-sm'}`}>
        {streak} {streak === 1 ? 'dia' : 'dias'}
      </span>
      {!compact && <span className="text-xs text-orange-400">seguidos</span>}
    </div>
  );
}
