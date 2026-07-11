/**
 * Single source of truth for the Team plan's seat limit. Mirrored on the
 * frontend at aulaiq/src/config/team.ts (the two runtimes are separate npm
 * projects, so it can't be a shared import — keep both in sync by hand).
 * The database is the real authority (teams.seats_total, enforced by
 * team_create_invitation/team_accept_invitation in the migration); this
 * constant is what the backend uses when *creating* a team's row.
 */
export const TEAM_MAX_INVITED_MEMBERS = 4
export const TEAM_MAX_SEATS = TEAM_MAX_INVITED_MEMBERS + 1 // admin + invited members
