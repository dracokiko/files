import { useState } from 'react';
import { requestPasswordReset } from '../../utils/auth';

export default function ChangePasswordCard({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setSending(true);
    setError('');
    const { error: err } = await requestPasswordReset(email);
    setSending(false);
    if (err) { setError(err); return; }
    setSent(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-bold text-gray-900 mb-1">Password</h2>
      <p className="text-xs text-gray-400 mb-4">
        Por segurança, alterar a password requer confirmação por email.
      </p>

      {sent ? (
        <p className="text-sm text-emerald-600">
          Email enviado para {email}. Segue o link para definires uma nova password.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="py-2.5 px-5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-60"
        >
          {sending ? 'A enviar...' : 'Enviar email de confirmação'}
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
