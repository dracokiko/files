import { useMemo } from 'react';
import type { TeamRole } from '../types/team';

// Central place for "what can this role do" — the UI uses this to decide
// what to render, but every one of these actions is re-checked server-side
// (backend/routes/team.js) on every request, so hiding a button here is a
// UX nicety, never the actual authorization boundary.
export function canManageTeam(role: TeamRole | null): boolean {
  return role === 'admin';
}

export function canViewTeamBilling(role: TeamRole | null): boolean {
  return role === 'admin';
}

export function canInviteMembers(role: TeamRole | null): boolean {
  return role === 'admin';
}

export function canRemoveMembers(role: TeamRole | null): boolean {
  return role === 'admin';
}

export function canRenameTeam(role: TeamRole | null): boolean {
  return role === 'admin';
}

export function canLeaveTeam(role: TeamRole | null): boolean {
  return role === 'member';
}

export function useTeamPermissions(role: TeamRole | null) {
  return useMemo(() => ({
    isAdmin: role === 'admin',
    isMember: role === 'member',
    canManageTeam: canManageTeam(role),
    canViewTeamBilling: canViewTeamBilling(role),
    canInviteMembers: canInviteMembers(role),
    canRemoveMembers: canRemoveMembers(role),
    canRenameTeam: canRenameTeam(role),
    canLeaveTeam: canLeaveTeam(role),
  }), [role]);
}
