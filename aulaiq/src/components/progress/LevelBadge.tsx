import { getLevelName } from '../../utils/progress';

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: { outer: 'w-8 h-8 text-xs', label: 'text-xs', name: 'hidden' },
  md: { outer: 'w-10 h-10 text-sm', label: 'text-xs', name: 'text-xs' },
  lg: { outer: 'w-14 h-14 text-base', label: 'text-sm', name: 'text-sm' },
};

export default function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  const s = SIZE[size];
  return (
    <div className="flex items-center gap-2">
      <div className={`${s.outer} rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200`}>
        <span className={`font-black text-white leading-none ${s.label}`}>{level}</span>
      </div>
      {size !== 'sm' && (
        <div>
          <p className={`font-bold text-gray-900 leading-none ${s.label}`}>Nível {level}</p>
          <p className={`text-gray-400 leading-tight mt-0.5 ${s.name}`}>{getLevelName(level)}</p>
        </div>
      )}
    </div>
  );
}
