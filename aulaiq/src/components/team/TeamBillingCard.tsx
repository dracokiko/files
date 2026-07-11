import { useState } from 'react';
import type { Team } from '../../types/team';
import { TeamApiError } from '../../types/team';
import { openBillingPortal } from '../../services/teamApi';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon',
  });
}

interface TeamBillingCardProps {
  team: Team;
}

export default function TeamBillingCard({ team }: TeamBillingCardProps) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const handleOpenPortal = async () => {
    setOpening(true);
    setError('');
    try {
      const url = await openBillingPortal(`${window.location.origin}/dashboard/team`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof TeamApiError ? err.message : 'Não foi possível abrir a gestão de subscrição.');
      setOpening(false);
    }
  };

  const paymentFailed = team.subscriptionStatus === 'past_due' || team.subscriptionStatus === 'unpaid';
  const cancelled = team.subscriptionStatus === 'canceled' || team.subscriptionStatus === 'incomplete_expired';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-bold text-gray-900 mb-4">Faturação</h2>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Plano</span>
          <span className="font-semibold text-gray-900">Team</span>
        </div>

        {paymentFailed && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-red-700">
              O último pagamento falhou. Atualiza o método de pagamento para evitar perder o acesso Team.
            </p>
          </div>
        )}

        {cancelled && (
          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
            <p className="text-xs text-gray-600">
              A subscrição está cancelada. Reativa para voltares a ter acesso ao plano Team.
            </p>
          </div>
        )}

        {!paymentFailed && !cancelled && team.currentPeriodEnd && (
          <div className="flex justify-between">
            <span className="text-gray-400">
              {team.cancelAtPeriodEnd ? 'Acesso até' : 'Próxima renovação'}
            </span>
            <span className="font-semibold text-gray-900">{formatDate(team.currentPeriodEnd)}</span>
          </div>
        )}

        {team.cancelAtPeriodEnd && !cancelled && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs text-amber-700">
              O cancelamento já está agendado — a equipa mantém acesso até {formatDate(team.currentPeriodEnd)} e não haverá renovação.
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      {team.hasStripeCustomer ? (
        <button
          type="button"
          onClick={handleOpenPortal}
          disabled={opening}
          className="w-full mt-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all duration-200 disabled:opacity-60"
        >
          {opening ? 'A abrir...' : 'Gerir subscrição'}
        </button>
      ) : (
        <p className="text-xs text-gray-400 mt-5">
          Ainda não há dados de faturação Stripe associados a esta equipa.
        </p>
      )}
    </div>
  );
}
