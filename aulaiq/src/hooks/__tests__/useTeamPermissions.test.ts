import { describe, it, expect } from 'vitest';
import {
  canManageTeam, canViewTeamBilling, canInviteMembers,
  canRemoveMembers, canRenameTeam, canLeaveTeam,
} from '../useTeamPermissions';

describe('team permission helpers', () => {
  it('grant admin-only actions to admin, never to member or no-team', () => {
    for (const fn of [canManageTeam, canViewTeamBilling, canInviteMembers, canRemoveMembers, canRenameTeam]) {
      expect(fn('admin')).toBe(true);
      expect(fn('member')).toBe(false);
      expect(fn(null)).toBe(false);
    }
  });

  it('only a member (not admin, not no-team) can leave', () => {
    expect(canLeaveTeam('member')).toBe(true);
    expect(canLeaveTeam('admin')).toBe(false);
    expect(canLeaveTeam(null)).toBe(false);
  });
});
