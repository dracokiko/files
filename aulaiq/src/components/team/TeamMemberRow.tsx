import { useState } from 'react';
import type { TeamMember } from '../../types/team';
import RemoveMemberDialog from './RemoveMemberDialog';

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  return source.charAt(0).toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface TeamMemberRowProps {
  member: TeamMember;
  canRemove: boolean;
  onRemoved: (memberId: string) => Promise<void>;
}

export default function TeamMemberRow({ member, canRemove, onRemoved }: TeamMemberRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-bold">{initials(member.name, member.email)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {member.name ?? member.email}
          </p>
          {member.isCurrentUser && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">Tu</span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{member.email}</p>
      </div>

      <div className="hidden sm:block text-xs text-gray-400 flex-shrink-0 w-28">
        Desde {formatDate(member.joinedAt)}
      </div>

      <span
        className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
          member.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {member.role === 'admin' ? 'Admin' : 'Membro'}
      </span>

      <div className="w-8 flex-shrink-0 flex justify-end">
        {canRemove && member.role !== 'admin' && !member.isCurrentUser && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remover ${member.name ?? member.email}`}
            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {confirming && (
        <RemoveMemberDialog
          member={member}
          onClose={() => setConfirming(false)}
          onConfirm={() => onRemoved(member.id)}
        />
      )}
    </div>
  );
}
