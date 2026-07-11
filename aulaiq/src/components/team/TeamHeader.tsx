import { useState } from 'react';
import type { Team } from '../../types/team';
import EditTeamNameDialog from './EditTeamNameDialog';

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-emerald-100 text-emerald-700' },
  trialing: { label: 'Em teste', className: 'bg-blue-100 text-blue-700' },
  past_due: { label: 'Pagamento em falha', className: 'bg-red-100 text-red-700' },
  canceled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-500' },
  incomplete: { label: 'Pagamento incompleto', className: 'bg-amber-100 text-amber-700' },
  incomplete_expired: { label: 'Pagamento expirado', className: 'bg-gray-100 text-gray-500' },
  unpaid: { label: 'Não paga', className: 'bg-red-100 text-red-700' },
  inactive: { label: 'Inativa', className: 'bg-gray-100 text-gray-500' },
};

interface TeamHeaderProps {
  team: Team;
  canRename: boolean;
  onRenamed: (name: string) => Promise<Team>;
}

export default function TeamHeader({ team, canRename, onRenamed }: TeamHeaderProps) {
  const [editing, setEditing] = useState(false);
  const status = STATUS_STYLE[team.subscriptionStatus] ?? STATUS_STYLE.inactive;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-xl font-black text-gray-900 truncate">{team.name}</h1>
            {canRename && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Editar nome da equipa"
                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
              Team
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
              {status.label}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
              {team.currentUserRole === 'admin' ? 'Administrador' : 'Membro'}
            </span>
          </div>
        </div>
      </div>

      {editing && (
        <EditTeamNameDialog
          currentName={team.name}
          onClose={() => setEditing(false)}
          onSave={async (name) => { await onRenamed(name); setEditing(false); }}
        />
      )}
    </div>
  );
}
