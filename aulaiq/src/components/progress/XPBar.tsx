import { calculateLevel, getLevelName } from '../../utils/progress';

interface XPBarProps {
  xp: number;
  showLabel?: boolean;
  compact?: boolean;
}

export default function XPBar({ xp, showLabel = true, compact = false }: XPBarProps) {
  const level = calculateLevel(xp);
  const xpInLevel = xp % 100;
  const pct = xpInLevel;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-500">{xp} XP</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-600">Nível {level} · {getLevelName(level)}</span>
          <span className="text-gray-400">{xpInLevel}/100 XP</span>
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-400">Total: {xp} XP · Próximo nível a {level * 100} XP</p>
      )}
    </div>
  );
}
