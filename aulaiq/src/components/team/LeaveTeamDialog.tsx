import { useState } from 'react';
import { TeamApiError, TEAM_ERROR_LABELS } from '../../types/team';

interface LeaveTeamDialogProps {
  teamName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function LeaveTeamDialog({ teamName, onClose, onConfirm }: LeaveTeamDialogProps) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLeaving(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof TeamApiError ? TEAM_ERROR_LABELS[err.code] : 'Não foi possível sair da equipa.');
      setLeaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={leaving ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <h3 className="text-base font-black text-gray-900 mb-1">Sair de "{teamName}"</h3>
        <p className="text-sm text-gray-600">
          Vais perder o acesso imediato às funcionalidades do plano Team. Um administrador terá de te convidar novamente para voltares a entrar.
        </p>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={leaving}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={leaving}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-60"
          >
            {leaving ? 'A sair...' : 'Sair da equipa'}
          </button>
        </div>
      </div>
    </div>
  );
}
