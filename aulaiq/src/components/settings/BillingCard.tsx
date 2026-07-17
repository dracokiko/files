import { useState } from 'react';
import { openPersonalBillingPortal, ProfileApiError } from '../../services/profileApi';
import type { Plan } from '../../types';

export default function BillingCard({ plan }: { plan: Plan }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const handleOpenPortal = async () => {
    setOpening(true);
    setError('');
    try {
      const url = await openPersonalBillingPortal(`${window.location.origin}/dashboard/settings`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ProfileApiError ? err.message : 'Não foi possível abrir a gestão de pagamento.');
      setOpening(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-bold text-gray-900 mb-1">Pagamento</h2>
      <p className="text-xs text-gray-400 mb-4">
        Atualiza o método de pagamento — a alteração aplica-se à tua próxima renovação.
      </p>

      {plan === 'free' ? (
        <p className="text-xs text-gray-400">Ainda não tens uma subscrição paga ativa.</p>
      ) : (
        <button
          type="button"
          onClick={handleOpenPortal}
          disabled={opening}
          className="py-2.5 px-5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-60"
        >
          {opening ? 'A abrir...' : 'Gerir pagamento'}
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
