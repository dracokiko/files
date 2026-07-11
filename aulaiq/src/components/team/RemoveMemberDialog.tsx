import { useState } from 'react';
import type { TeamMember } from '../../types/team';
import { TeamApiError, TEAM_ERROR_LABELS } from '../../types/team';

interface RemoveMemberDialogProps {
  member: TeamMember;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function RemoveMemberDialog({ member, onClose, onConfirm }: RemoveMemberDialogProps) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setRemoving(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof TeamApiError ? TEAM_ERROR_LABELS[err.code] : 'Não foi possível remover o membro.');
      setRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={removing ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
          </svg>
        </div>
        <h3 className="text-base font-black text-gray-900 mb-1">Remover membro</h3>
        <p className="text-sm text-gray-600">
          Tens a certeza que queres remover <span className="font-semibold text-gray-900">{member.name ?? member.email}</span>{' '}
          (<span className="truncate">{member.email}</span>) da equipa?
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Esta pessoa perde imediatamente o acesso às funcionalidades do plano Team.
        </p>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={removing}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={removing}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-60"
          >
            {removing ? 'A remover...' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  );
}
