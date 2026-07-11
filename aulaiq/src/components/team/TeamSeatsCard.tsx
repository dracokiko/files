import type { Team } from '../../types/team';

interface TeamSeatsCardProps {
  team: Team;
}

export default function TeamSeatsCard({ team }: TeamSeatsCardProps) {
  const { seatsUsed, seatsTotal, seatsAvailable } = team;
  const pct = seatsTotal > 0 ? Math.min(100, Math.round((seatsUsed / seatsTotal) * 100)) : 0;
  const full = seatsAvailable === 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">Lugares</h2>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${full ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
          {full ? 'Sem lugares livres' : `${seatsAvailable} livre${seatsAvailable === 1 ? '' : 's'}`}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-2">
        <span className="font-bold text-gray-900">{seatsUsed}</span> de <span className="font-bold text-gray-900">{seatsTotal}</span> lugares ocupados
      </p>

      <div
        role="progressbar"
        aria-valuenow={seatsUsed}
        aria-valuemin={0}
        aria-valuemax={seatsTotal}
        aria-label="Lugares ocupados"
        className="h-2.5 bg-gray-100 rounded-full overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${full ? 'bg-amber-400' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Inclui o administrador e convites pendentes que ainda não foram aceites.
      </p>
    </div>
  );
}
