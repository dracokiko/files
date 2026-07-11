import { useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import type { InvitationLookup } from '../types/team';
import { TeamApiError } from '../types/team';
import * as teamApi from '../services/teamApi';

interface TeamInvitationPageProps {
  token: string;
  user: UserProfile | null;
  onLoginClick: () => void;
  onSignUpClick: () => void;
  onAccepted: () => void;
}

type LookupState =
  | { kind: 'loading' }
  | { kind: 'network-error' }
  | { kind: 'not-found' }
  | { kind: 'ready'; invitation: InvitationLookup };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 w-full max-w-md p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center mx-auto mb-5">
          <span className="text-white font-black text-lg">A</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function TeamInvitationPage({ token, user, onLoginClick, onSignUpClick, onAccepted }: TeamInvitationPageProps) {
  const [state, setState] = useState<LookupState>({ kind: 'loading' });
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    teamApi.lookupInvitation(token)
      .then((invitation) => { if (!cancelled) setState({ kind: 'ready', invitation }); })
      .catch((err) => {
        if (cancelled) return;
        setState(err instanceof TeamApiError ? { kind: 'not-found' } : { kind: 'network-error' });
      });
    return () => { cancelled = true; };
  }, [token]);

  if (state.kind === 'loading') {
    return (
      <Shell>
        <svg className="w-6 h-6 animate-spin text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </Shell>
    );
  }

  if (state.kind === 'network-error') {
    return (
      <Shell>
        <h1 className="text-lg font-black text-gray-900 mb-1">Erro de ligação</h1>
        <p className="text-sm text-gray-500">Não foi possível verificar o convite. Verifica a tua ligação e tenta novamente.</p>
      </Shell>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <Shell>
        <h1 className="text-lg font-black text-gray-900 mb-1">Convite inválido</h1>
        <p className="text-sm text-gray-500">Este link de convite não existe ou já não é válido.</p>
      </Shell>
    );
  }

  const { invitation } = state;

  if (invitation.status === 'expired') {
    return (
      <Shell>
        <h1 className="text-lg font-black text-gray-900 mb-1">Convite expirado</h1>
        <p className="text-sm text-gray-500">
          O convite para a equipa <strong>{invitation.teamName}</strong> já expirou. Pede ao administrador para enviar um novo.
        </p>
      </Shell>
    );
  }

  if (invitation.status === 'cancelled') {
    return (
      <Shell>
        <h1 className="text-lg font-black text-gray-900 mb-1">Convite cancelado</h1>
        <p className="text-sm text-gray-500">Este convite foi cancelado pelo administrador da equipa.</p>
      </Shell>
    );
  }

  if (invitation.status === 'accepted') {
    return (
      <Shell>
        <h1 className="text-lg font-black text-gray-900 mb-1">Convite já aceite</h1>
        <p className="text-sm text-gray-500">Este convite já foi usado. Inicia sessão para aceder à equipa.</p>
        {!user && (
          <button
            onClick={onLoginClick}
            className="mt-5 w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all"
          >
            Entrar
          </button>
        )}
      </Shell>
    );
  }

  // status === 'pending'
  const emailMismatch = user && user.email.toLowerCase() !== invitation.email.toLowerCase();

  const handleAccept = async () => {
    setActing('accept'); setActionError('');
    try {
      await teamApi.acceptInvitation(token);
      onAccepted();
    } catch (err) {
      setActionError(err instanceof TeamApiError ? err.message : 'Não foi possível aceitar o convite.');
      setActing(null);
    }
  };

  const handleDecline = async () => {
    setActing('decline'); setActionError('');
    try {
      await teamApi.declineInvitation(token);
      setState({ kind: 'ready', invitation: { ...invitation, status: 'cancelled' } });
    } catch (err) {
      setActionError(err instanceof TeamApiError ? err.message : 'Não foi possível rejeitar o convite.');
      setActing(null);
    }
  };

  return (
    <Shell>
      <h1 className="text-lg font-black text-gray-900 mb-1">
        {invitation.inviterName ?? 'Um administrador'} convidou-te
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Junta-te à equipa <strong>{invitation.teamName}</strong> no AulaIQ, com o email <strong>{invitation.email}</strong>.
      </p>

      {!user ? (
        <div className="space-y-2.5">
          <button
            onClick={onLoginClick}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all"
          >
            Entrar para aceitar
          </button>
          <button
            onClick={onSignUpClick}
            className="w-full py-3 text-sm font-semibold text-gray-700 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:text-blue-600 transition-all"
          >
            Criar conta
          </button>
        </div>
      ) : emailMismatch ? (
        <div className="text-left">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700">
              Este convite foi enviado para <strong>{invitation.email}</strong>, mas tens sessão iniciada como <strong>{user.email}</strong>.
              Termina sessão e entra com o email correto para aceitar.
            </p>
          </div>
        </div>
      ) : (
        <>
          {actionError && <p className="text-xs text-red-600 mb-3">{actionError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={acting !== null}
              className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-60"
            >
              {acting === 'decline' ? 'A rejeitar...' : 'Rejeitar'}
            </button>
            <button
              onClick={handleAccept}
              disabled={acting !== null}
              className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-60"
            >
              {acting === 'accept' ? 'A aceitar...' : 'Aceitar convite'}
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}
