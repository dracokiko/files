import { useState } from 'react';
import { TeamApiError, TEAM_ERROR_LABELS } from '../../types/team';

interface EditTeamNameDialogProps {
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export default function EditTeamNameDialog({ currentName, onClose, onSave }: EditTeamNameDialogProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      setError('O nome deve ter entre 2 e 60 caracteres.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(trimmed);
    } catch (err) {
      setError(err instanceof TeamApiError ? TEAM_ERROR_LABELS[err.code] : 'Não foi possível guardar.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up"
      >
        <h3 className="text-base font-black text-gray-900 mb-4">Editar nome da equipa</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          autoFocus
          maxLength={60}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || name.trim() === currentName}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
