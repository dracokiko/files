import { useState } from 'react';

interface ResetPasswordModalProps {
  onSubmit: (password: string) => Promise<string | null>;
  onDone: () => void;
}

export default function ResetPasswordModal({ onSubmit, onDone }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As passwords não coincidem.');
      return;
    }

    setLoading(true);
    const submitError = await onSubmit(password);
    setLoading(false);

    if (submitError) {
      setError(submitError);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 to-violet-600 px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center p-1.5">
              <img src="/images/logo-mark.png" alt="" className="w-full h-full object-contain" />
            </div>
            <span className="text-white font-black text-lg">Kepos</span>
          </div>
          <h2 className="text-xl font-black text-white">Nova password</h2>
          <p className="text-blue-100 text-sm mt-1">
            {done ? 'Password atualizada com sucesso.' : 'Escolhe uma nova password para a tua conta.'}
          </p>
        </div>

        {done ? (
          <div className="px-8 py-6 space-y-4">
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-green-700">A tua password foi atualizada. Já podes continuar.</p>
            </div>
            <button
              type="button"
              onClick={onDone}
              className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01] transition-all duration-200"
            >
              Continuar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nova password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Nova password"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirmar password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Confirma a nova password"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  A guardar...
                </>
              ) : (
                'Guardar nova password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
