import type { TeamMember } from '../../types/team';
import TeamMemberRow from './TeamMemberRow';

interface TeamMembersListProps {
  members: TeamMember[];
  loading: boolean;
  canRemove: boolean;
  onRemoved: (memberId: string) => Promise<void>;
}

function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-32" />
        <div className="h-2.5 bg-gray-100 rounded w-40" />
      </div>
      <div className="h-5 w-14 bg-gray-100 rounded-full" />
    </div>
  );
}

export default function TeamMembersList({ members, loading, canRemove, onRemoved }: TeamMembersListProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 sm:px-6 pt-5 pb-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Membros</h2>
        <p className="text-xs text-gray-400 mt-0.5">Pessoas com acesso ao plano Team desta equipa.</p>
      </div>

      <div className="divide-y divide-gray-50">
        {loading ? (
          <>
            <MemberRowSkeleton />
            <MemberRowSkeleton />
          </>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Ainda não há membros.</p>
        ) : (
          members.map((member) => (
            <TeamMemberRow key={member.id} member={member} canRemove={canRemove} onRemoved={onRemoved} />
          ))
        )}
      </div>
    </div>
  );
}
