import { useState } from 'react';
import type { MyPendingInvitation } from '../../types/team';
import { TeamApiError } from '../../types/team';
import { TEAM_MAX_INVITED_MEMBERS, TEAM_MAX_SEATS } from '../../config/team';
import { supabase } from '../../lib/supabase';

interface TeamEmptyStateProps {
  myInvitation: MyPendingInvitation | null;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TeamEmptyState({ myInvitation, onAccept, onDecline }: TeamEmptyStateProps) {
  const [busy, setBusy] = useState<'accept' | 'decline' | 'checkout' | null>(null);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setBusy('accept'); setError('');
    try { await onAccept(); } catch (err) {
      setError(err instanceof TeamApiError ? err.message : 'Não foi possível aceitar o convite.');
    } finally { setBusy(null); }
  };

  const handleDecline = async () => {
    setBusy('decline'); setError('');
    try { await onDecline(); } catch (err) {
      setError(err instanceof TeamApiError ? err.message : 'Não foi possível rejeitar o convite.');
    } finally { setBusy(null); }
  };

  const handleJoinTeamPlan = async () => {
    setBusy('checkout'); setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: {
          planId: 'team',
          successUrl: `${window.location.origin}/dashboard/team?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard/team`,
        },
      });
      if (fnError || !data?.url) throw new Error('checkout indisponível');
      window.location.href = data.url;
    } catch {
      setError('Pagamento temporariamente indisponível. Contacta o suporte.');
      setBusy(null);
    }
  };

  if (myInvitation) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-black text-gray-900 mb-1">Tens um convite pendente</h2>
        <p className="text-sm text-gray-500 mb-1">
          Foste convidado para a equipa <span className="font-semibold text-gray-800">{myInvitation.teamName ?? 'Team'}</span>.
        </p>
        <p className="text-xs text-gray-400 mb-6">Expira a {formatDate(myInvitation.expiresAt)}</p>

        {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDecline}
            disabled={busy !== null}
            className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-60"
          >
            {busy === 'decline' ? 'A rejeitar...' : 'Rejeitar'}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={busy !== null}
            className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-60"
          >
            {busy === 'accept' ? 'A aceitar...' : 'Aceitar convite'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 3c0-1.657-3.582-3-8-3s-8 1.343-8 3v2h16v-2z" />
        </svg>
      </div>
      <h2 className="text-lg font-black text-gray-900 mb-1">Ainda não fazes parte de uma equipa</h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        O plano Team dá-te 1 administrador + {TEAM_MAX_INVITED_MEMBERS} membros ({TEAM_MAX_SEATS} pessoas no total),
        cada um com a sua própria quota e progresso, com um painel de gestão para o administrador.
      </p>

      {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

      <button
        type="button"
        onClick={handleJoinTeamPlan}
        disabled={busy !== null}
        className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01] transition-all duration-200 disabled:opacity-60"
      >
        {busy === 'checkout' ? 'A preparar pagamento...' : 'Ativar Versão Team'}
      </button>
      <p className="text-xs text-gray-400 mt-3">
        Já tens um convite à espera? Confirma o email que recebeste — o link de convite trata de tudo.
      </p>
    </div>
  );
}
