import { useState } from 'react';
import type { TeamInvitation } from '../../types/team';
import { TeamApiError, TEAM_ERROR_LABELS } from '../../types/team';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface InvitationRowProps {
  invitation: TeamInvitation;
  onResend: (id: string) => Promise<unknown>;
  onCancel: (id: string) => Promise<void>;
}

function InvitationRow({ invitation, onResend, onCancel }: InvitationRowProps) {
  const [busy, setBusy] = useState<'resend' | 'cancel' | null>(null);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setBusy('resend');
    setError('');
    try {
      await onResend(invitation.id);
    } catch (err) {
      setError(err instanceof TeamApiError ? TEAM_ERROR_LABELS[err.code] : 'Não foi possível reenviar.');
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    setBusy('cancel');
    setError('');
    try {
      await onCancel(invitation.id);
    } catch (err) {
      setError(err instanceof TeamApiError ? TEAM_ERROR_LABELS[err.code] : 'Não foi possível cancelar.');
      setBusy(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-3.5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{invitation.email}</p>
          <p className="text-xs text-gray-400">
            Convidado a {formatDate(invitation.createdAt)} · expira a {formatDate(invitation.expiresAt)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleResend}
            disabled={busy !== null}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-60"
          >
            {busy === 'resend' ? 'A reenviar...' : 'Reenviar'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy !== null}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60"
          >
            {busy === 'cancel' ? 'A cancelar...' : 'Cancelar'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

interface PendingInvitationsProps {
  invitations: TeamInvitation[];
  loading: boolean;
  onResend: (id: string) => Promise<unknown>;
  onCancel: (id: string) => Promise<void>;
}

export default function PendingInvitations({ invitations, loading, onResend, onCancel }: PendingInvitationsProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
        <div className="h-3 bg-gray-100 rounded w-40 mb-4" />
        <div className="h-10 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (invitations.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 sm:px-6 pt-5 pb-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Convites pendentes</h2>
        <p className="text-xs text-gray-400 mt-0.5">Ainda não foram aceites — reservam lugar na equipa.</p>
      </div>
      <div className="divide-y divide-gray-50">
        {invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} onResend={onResend} onCancel={onCancel} />
        ))}
      </div>
    </div>
  );
}
