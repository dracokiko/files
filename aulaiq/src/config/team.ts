/**
 * Single source of truth for the Team plan's seat limit on the frontend.
 * Mirrors backend/config/team.js — the two runtimes are separate npm
 * projects so this can't be a shared import; the database
 * (teams.seats_total) is the real authority either way.
 */
export const TEAM_MAX_INVITED_MEMBERS = 4;
export const TEAM_MAX_SEATS = TEAM_MAX_INVITED_MEMBERS + 1; // admin + invited members
