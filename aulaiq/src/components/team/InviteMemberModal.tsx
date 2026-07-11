import { useState } from 'react';
import type { TeamMember, TeamInvitation } from '../../types/team';
import { TeamApiError, TEAM_ERROR_LABELS } from '../../types/team';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface InviteMemberModalProps {
  seatsAvailable: number;
  members: TeamMember[];
  invitations: TeamInvitation[];
  onClose: () => void;
  onInvite: (email: string) => Promise<{ invitation: TeamInvitation; emailSent: boolean }>;
}

export default function InviteMemberModal({ seatsAvailable, members, invitations, onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ email: string; emailSent: boolean } | null>(null);

  const noSeats = seatsAvailable <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return; // guards against a double submit from a fast double-click
    setError('');

    const normalized = email.trim().toLowerCase();
    if (!normalized) { setError('Introduz um email.'); return; }
    if (!EMAIL_RE.test(normalized)) { setError(TEAM_ERROR_LABELS.INVALID_EMAIL); return; }
    if (noSeats) { setError(TEAM_ERROR_LABELS.TEAM_MEMBER_LIMIT_REACHED); return; }
    if (members.some((m) => m.email.toLowerCase() === normalized)) {
      setError(TEAM_ERROR_LABELS.USER_ALREADY_TEAM_MEMBER); return;
    }
    if (invitations.some((i) => i.email.toLowerCase() === normalized)) {
      setError(TEAM_ERROR_LABELS.INVITATION_ALREADY_PENDING); return;
    }

    setSending(true);
    try {
      const { emailSent } = await onInvite(normalized);
      setResult({ email: normalized, emailSent });
    } catch (err) {
      setError(err instanceof TeamApiError ? TEAM_ERROR_LABELS[err.code] : 'Não foi possível enviar o convite.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-gradient-to-br from-blue-600 to-violet-600 px-8 pt-8 pb-6">
          <h2 className="text-xl font-black text-white">Convidar membro</h2>
          <p className="text-blue-100 text-sm mt-1">
            {noSeats ? 'A equipa não tem lugares livres.' : `${seatsAvailable} lugar${seatsAvailable === 1 ? '' : 'es'} disponível${seatsAvailable === 1 ? '' : 'is'}.`}
          </p>
        </div>

        {result ? (
          <div className="px-8 py-6 space-y-4">
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-green-700">
                {result.emailSent
                  ? <>Convite enviado para <strong>{result.email}</strong>.</>
                  : <>Convite criado para <strong>{result.email}</strong>, mas o email não pôde ser enviado — usa "Reenviar" na lista de convites assim que o envio de email estiver configurado.</>}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all duration-200"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email do convidado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="colega@email.com"
                autoFocus
                disabled={noSeats}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200 disabled:opacity-60"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                A pessoa recebe um email com um link para se juntar à equipa. O convite expira em 7 dias.
              </p>
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
              disabled={sending || noSeats}
              className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  A enviar...
                </>
              ) : (
                'Enviar convite'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
