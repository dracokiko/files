import { useState } from 'react';
import { useTeam } from '../hooks/useTeam';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { useTeamInvitations } from '../hooks/useTeamInvitations';
import { useTeamPermissions } from '../hooks/useTeamPermissions';
import TeamHeader from '../components/team/TeamHeader';
import TeamSeatsCard from '../components/team/TeamSeatsCard';
import TeamMembersList from '../components/team/TeamMembersList';
import PendingInvitations from '../components/team/PendingInvitations';
import InviteMemberModal from '../components/team/InviteMemberModal';
import TeamBillingCard from '../components/team/TeamBillingCard';
import TeamEmptyState from '../components/team/TeamEmptyState';
import LeaveTeamDialog from '../components/team/LeaveTeamDialog';
import * as teamApi from '../services/teamApi';

interface TeamPageProps {
  onBack: () => void;
}

function TeamPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-24 bg-white rounded-2xl border border-gray-100" />
      <div className="h-28 bg-white rounded-2xl border border-gray-100" />
      <div className="h-48 bg-white rounded-2xl border border-gray-100" />
    </div>
  );
}

export default function TeamPage({ onBack }: TeamPageProps) {
  const { team, myInvitation, loading, error, refresh, rename, leave } = useTeam();
  const permissions = useTeamPermissions(team?.currentUserRole ?? null);
  const { members, loading: membersLoading, remove: removeMember } = useTeamMembers(Boolean(team));
  const {
    invitations, loading: invitationsLoading, invite, resend, cancel,
  } = useTeamInvitations(Boolean(team) && permissions.isAdmin);

  const [showInvite, setShowInvite] = useState(false);
  const [showLeave, setShowLeave] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal top bar, consistent with the subject-detail view */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <span className="font-black text-gray-900 text-sm">Equipa</span>
        <div className="w-16" />
      </div>

      {loading ? (
        <TeamPageSkeleton />
      ) : error ? (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : !team ? (
        <div className="px-4 py-12">
          <TeamEmptyState
            myInvitation={myInvitation}
            onAccept={async () => { await teamApi.acceptMyInvitation(); await refresh(); }}
            onDecline={async () => { await teamApi.declineMyInvitation(); await refresh(); }}
          />
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <TeamHeader team={team} canRename={permissions.canRenameTeam} onRenamed={rename} />

          <TeamSeatsCard team={team} />

          <div className="flex items-center justify-between">
            <h2 className="sr-only">Membros e convites</h2>
            {permissions.canInviteMembers && (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                disabled={team.seatsAvailable <= 0}
                className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Convidar membro
              </button>
            )}
          </div>

          <TeamMembersList
            members={members}
            loading={membersLoading}
            canRemove={permissions.canRemoveMembers}
            onRemoved={removeMember}
          />

          {permissions.isAdmin && (
            <PendingInvitations
              invitations={invitations}
              loading={invitationsLoading}
              onResend={resend}
              onCancel={cancel}
            />
          )}

          {permissions.canViewTeamBilling && <TeamBillingCard team={team} />}

          {permissions.canLeaveTeam && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-900">Sair da equipa</p>
                <p className="text-xs text-gray-400 mt-0.5">Perdes o acesso às funcionalidades do plano Team.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLeave(true)}
                className="text-sm font-semibold text-red-600 hover:underline flex-shrink-0"
              >
                Sair
              </button>
            </div>
          )}

          {permissions.isAdmin && (
            <p className="text-xs text-gray-400 text-center leading-relaxed px-4">
              Como administrador, não podes simplesmente sair da equipa — para deixar de ser administrador,
              contacta o suporte para transferir a propriedade ou dissolver a equipa.
            </p>
          )}
        </div>
      )}

      {showInvite && team && (
        <InviteMemberModal
          seatsAvailable={team.seatsAvailable}
          members={members}
          invitations={invitations}
          onClose={() => setShowInvite(false)}
          onInvite={async (email) => { const r = await invite(email); await refresh(); return r; }}
        />
      )}

      {showLeave && team && (
        <LeaveTeamDialog
          teamName={team.name}
          onClose={() => setShowLeave(false)}
          onConfirm={async () => { await leave(); setShowLeave(false); }}
        />
      )}
    </div>
  );
}
