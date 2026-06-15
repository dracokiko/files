interface MasteryProgressProps {
  mastery: number; // 0–100
  size?: 'sm' | 'md';
}

function masteryColor(m: number) {
  if (m >= 70) return 'text-emerald-600';
  if (m >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function masteryBarColor(m: number) {
  if (m >= 70) return 'from-emerald-400 to-emerald-600';
  if (m >= 40) return 'from-amber-400 to-amber-500';
  return 'from-red-400 to-red-500';
}

function masteryLabel(m: number) {
  if (m >= 80) return 'Dominado';
  if (m >= 60) return 'Bom';
  if (m >= 40) return 'A melhorar';
  if (m > 0) return 'Início';
  return 'Sem dados';
}

export default function MasteryProgress({ mastery, size = 'md' }: MasteryProgressProps) {
  const color = masteryColor(mastery);
  const barColor = masteryBarColor(mastery);
  const label = masteryLabel(mastery);

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${mastery}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${color}`}>{mastery}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-600">Mastery</span>
        <span className={`text-xs font-bold ${color}`}>{mastery}% · {label}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${mastery}%` }}
        />
      </div>
    </div>
  );
}
