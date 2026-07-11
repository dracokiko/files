import express from 'express'
import { requireUser } from '../middleware/auth.js'
import { sendMail, buildTeamInvitationEmail } from '../services/email.js'
import {
  normalizeEmail,
  validateTeamName,
  mapMemberRow,
  mapInvitationRow,
  mapTeamRow,
  computeSeats,
  extractTeamErrorCode,
  teamErrorResponse,
  TEAM_ERROR_MESSAGES,
} from '../services/team.js'

/**
 * Team plan API. Every route derives the caller's team from their own
 * `req.userId` (verified server-side by requireUser) — no route accepts a
 * team id, member id ownership, or role from the request body/query as fact;
 * each is re-checked against the database on every call. Seat-limit
 * enforcement lives in Postgres (team_create_invitation / team_accept_invitation
 * in the migration) so concurrent requests can't race past the limit.
 */
export default function teamRoutes({ supabase, supabaseAdmin }) {
  const router = express.Router()
  const db = supabaseAdmin

  function sendTeamError(res, code, status = 400) {
    const { status: mappedStatus, body } = teamErrorResponse(code, status)
    return res.status(mappedStatus).json(body)
  }

  /** Active team_members row (+ team) for a user, or null. */
  async function getActiveMembership(userId) {
    const { data, error } = await db
      .from('team_members')
      .select('id, team_id, role, status, joined_at, teams(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    if (error) throw error
    return data
  }

  async function getSeatCounts(teamId, seatsTotal) {
    const [{ count: activeMemberCount }, { count: pendingInvitationCount }] = await Promise.all([
      db.from('team_members').select('id', { count: 'exact', head: true })
        .eq('team_id', teamId).eq('status', 'active'),
      db.from('team_invitations').select('id', { count: 'exact', head: true })
        .eq('team_id', teamId).eq('status', 'pending').gt('expires_at', new Date().toISOString()),
    ])
    return computeSeats({
      activeMemberCount: activeMemberCount ?? 0,
      pendingInvitationCount: pendingInvitationCount ?? 0,
      seatsTotal,
    })
  }

  // ── Public: minimal invitation info by token (no auth — the page needs to
  // show "you've been invited to X" before the visitor logs in) ───────────
  router.get('/invitations/token/:token', async (req, res) => {
    const { data, error } = await db.rpc('team_invitation_lookup', { p_token: req.params.token })
    if (error) {
      const code = extractTeamErrorCode(error.message) ?? 'INVITATION_INVALID'
      return sendTeamError(res, code, 404)
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return sendTeamError(res, 'INVITATION_INVALID', 404)
    res.json({
      teamName: row.team_name,
      inviterName: row.inviter_name,
      email: row.email,
      status: row.status,
      expiresAt: row.expires_at,
    })
  })

  // Everything below requires a verified Supabase session.
  router.use(requireUser(supabase))

  // ── Current user's team ──────────────────────────────────────────────
  router.get('/', async (req, res) => {
    const membership = await getActiveMembership(req.userId).catch((e) => {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message }); return null
    })
    if (membership === null) return
    if (!membership) return res.json({ team: null })

    const team = membership.teams
    const { seatsUsed, seatsAvailable } = await getSeatCounts(team.id, team.seats_total)
    res.json({ team: mapTeamRow(team, { role: membership.role, seatsUsed, seatsAvailable }) })
  })

  // Pending invitation addressed to the caller's own account email —
  // powers the "you have a pending invite" state for users without a team.
  router.get('/my-invitation', async (req, res) => {
    const { data: profile, error: pErr } = await db.from('profiles').select('email').eq('id', req.userId).single()
    if (pErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: pErr.message })

    const { data, error } = await db
      .from('team_invitations')
      .select('id, email, status, expires_at, created_at, teams(name)')
      .eq('email', normalizeEmail(profile.email))
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })
    if (!data) return res.json({ invitation: null })

    res.json({ invitation: { ...mapInvitationRow(data), teamName: data.teams?.name ?? null } })
  })

  router.post('/my-invitation/accept', async (req, res) => {
    const { data: profile, error: pErr } = await db.from('profiles').select('email').eq('id', req.userId).single()
    if (pErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: pErr.message })

    const { data: invitation, error: findErr } = await db
      .from('team_invitations').select('id')
      .eq('email', normalizeEmail(profile.email)).eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (findErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: findErr.message })
    if (!invitation) return sendTeamError(res, 'INVITATION_INVALID', 404)

    const { data, error } = await db.rpc('team_accept_invitation_by_id', {
      p_invitation_id: invitation.id, p_user_id: req.userId,
    })
    if (error) {
      const code = extractTeamErrorCode(error.message) ?? 'INVITATION_INVALID'
      if (!(code in TEAM_ERROR_MESSAGES)) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })
      return sendTeamError(res, code, 409)
    }
    const row = Array.isArray(data) ? data[0] : data
    res.json({ teamId: row.team_id, teamName: row.team_name })
  })

  router.post('/my-invitation/decline', async (req, res) => {
    const { data: profile, error: pErr } = await db.from('profiles').select('email').eq('id', req.userId).single()
    if (pErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: pErr.message })

    const { data: invitation, error: findErr } = await db
      .from('team_invitations').select('id, status')
      .eq('email', normalizeEmail(profile.email)).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (findErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: findErr.message })
    if (!invitation) return sendTeamError(res, 'INVITATION_INVALID', 404)

    const { error } = await db.from('team_invitations').update({ status: 'cancelled' }).eq('id', invitation.id)
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    res.json({ ok: true })
  })

  router.patch('/', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)
    if (membership.role !== 'admin') return sendTeamError(res, 'TEAM_ADMIN_REQUIRED', 403)

    const validation = validateTeamName(req.body?.name)
    if (!validation.valid) return sendTeamError(res, validation.error, 422)

    const { data, error } = await db.from('teams')
      .update({ name: validation.value }).eq('id', membership.team_id).select().single()
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    const { seatsUsed, seatsAvailable } = await getSeatCounts(data.id, data.seats_total)
    res.json({ team: mapTeamRow(data, { role: 'admin', seatsUsed, seatsAvailable }) })
  })

  // ── Members ───────────────────────────────────────────────────────────
  router.get('/members', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)

    const { data, error } = await db
      .from('team_members')
      .select('id, user_id, role, status, joined_at, profiles(name, email)')
      .eq('team_id', membership.team_id)
      .eq('status', 'active')
      .order('role', { ascending: true }) // admin first
      .order('joined_at', { ascending: true })
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    res.json({ members: data.map((row) => mapMemberRow(row, req.userId)) })
  })

  router.delete('/members/:id', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)
    if (membership.role !== 'admin') return sendTeamError(res, 'TEAM_ADMIN_REQUIRED', 403)

    const { data: target, error: findErr } = await db
      .from('team_members').select('id, team_id, role, user_id')
      .eq('id', req.params.id).eq('status', 'active').maybeSingle()
    if (findErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: findErr.message })
    // Ownership check: the target row must belong to the admin's own team —
    // req.params.id alone is never trusted as sufficient.
    if (!target || target.team_id !== membership.team_id) return sendTeamError(res, 'MEMBER_NOT_FOUND', 404)
    if (target.role === 'admin') return sendTeamError(res, 'CANNOT_REMOVE_ADMIN', 400)

    const { error } = await db.from('team_members')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('id', target.id)
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    // Revoke the Team-plan entitlement (profiles.plan, the field every
    // academic feature check gates on) now that this user is no longer an
    // active member. They never separately paid for it, so 'free' is correct.
    await db.from('profiles').update({ plan: 'free' }).eq('id', target.user_id)

    res.json({ ok: true })
  })

  router.post('/leave', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)
    if (membership.role === 'admin') return sendTeamError(res, 'ADMIN_CANNOT_LEAVE', 400)

    const { error } = await db.from('team_members')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('id', membership.id)
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    await db.from('profiles').update({ plan: 'free' }).eq('id', req.userId)

    res.json({ ok: true })
  })

  // ── Invitations ───────────────────────────────────────────────────────
  router.get('/invitations', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)
    if (membership.role !== 'admin') return sendTeamError(res, 'TEAM_ADMIN_REQUIRED', 403)

    const { data, error } = await db
      .from('team_invitations')
      .select('id, email, status, expires_at, created_at')
      .eq('team_id', membership.team_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    res.json({ invitations: data.map(mapInvitationRow) })
  })

  async function createAndSendInvitation({ teamId, adminId, email, res }) {
    const { data, error } = await db.rpc('team_create_invitation', {
      p_team_id: teamId, p_admin_id: adminId, p_email: email,
    })
    if (error) {
      const code = extractTeamErrorCode(error.message) ?? 'INTERNAL_ERROR'
      if (code === 'INTERNAL_ERROR') return res.status(500).json({ error: code, message: error.message })
      return sendTeamError(res, code, 409)
    }
    const row = Array.isArray(data) ? data[0] : data

    const [{ data: team }, { data: admin }] = await Promise.all([
      db.from('teams').select('name').eq('id', teamId).single(),
      db.from('profiles').select('name').eq('id', adminId).single(),
    ])

    const inviteUrl = `${process.env.APP_ORIGIN || 'https://keposlearn.com'}/team/invite/${row.token}`
    const { subject, text, html } = buildTeamInvitationEmail({
      teamName: team?.name ?? 'a equipa', inviterName: admin?.name ?? 'Um administrador', inviteUrl,
    })
    const emailSent = await sendMail({ to: row.email, subject, text, html })

    res.status(201).json({ invitation: mapInvitationRow(row), emailSent })
  }

  router.post('/invitations', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)
    if (membership.role !== 'admin') return sendTeamError(res, 'TEAM_ADMIN_REQUIRED', 403)

    const email = normalizeEmail(req.body?.email)
    if (!email) return sendTeamError(res, 'INVALID_EMAIL', 422)

    await createAndSendInvitation({ teamId: membership.team_id, adminId: req.userId, email, res })
  })

  router.post('/invitations/:id/resend', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)
    if (membership.role !== 'admin') return sendTeamError(res, 'TEAM_ADMIN_REQUIRED', 403)

    const { data: existing, error: findErr } = await db
      .from('team_invitations').select('id, team_id, email, status')
      .eq('id', req.params.id).maybeSingle()
    if (findErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: findErr.message })
    if (!existing || existing.team_id !== membership.team_id) return sendTeamError(res, 'INVITATION_INVALID', 404)
    if (existing.status !== 'pending') return sendTeamError(res, 'INVITATION_INVALID', 409)

    // Cancel + recreate so the token and 7-day expiry are fresh.
    const { error: cancelErr } = await db.from('team_invitations').update({ status: 'cancelled' }).eq('id', existing.id)
    if (cancelErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: cancelErr.message })

    await createAndSendInvitation({ teamId: membership.team_id, adminId: req.userId, email: existing.email, res })
  })

  router.delete('/invitations/:id', async (req, res) => {
    const membership = await getActiveMembership(req.userId)
    if (!membership) return sendTeamError(res, 'NOT_TEAM_MEMBER', 404)
    if (membership.role !== 'admin') return sendTeamError(res, 'TEAM_ADMIN_REQUIRED', 403)

    const { data: existing, error: findErr } = await db
      .from('team_invitations').select('id, team_id, status').eq('id', req.params.id).maybeSingle()
    if (findErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: findErr.message })
    if (!existing || existing.team_id !== membership.team_id) return sendTeamError(res, 'INVITATION_INVALID', 404)

    const { error } = await db.from('team_invitations').update({ status: 'cancelled' }).eq('id', existing.id)
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    res.json({ ok: true })
  })

  router.post('/invitations/token/:token/accept', async (req, res) => {
    const { data, error } = await db.rpc('team_accept_invitation', {
      p_token: req.params.token, p_user_id: req.userId,
    })
    if (error) {
      const code = extractTeamErrorCode(error.message) ?? 'INVITATION_INVALID'
      if (!(code in TEAM_ERROR_MESSAGES)) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })
      return sendTeamError(res, code, 409)
    }
    const row = Array.isArray(data) ? data[0] : data
    res.json({ teamId: row.team_id, teamName: row.team_name })
  })

  router.post('/invitations/token/:token/decline', async (req, res) => {
    const { data: profile, error: pErr } = await db.from('profiles').select('email').eq('id', req.userId).single()
    if (pErr) return res.status(500).json({ error: 'INTERNAL_ERROR', message: pErr.message })

    const { data: existing, error: findErr } = await db.rpc('team_invitation_lookup', { p_token: req.params.token })
    if (findErr) return sendTeamError(res, 'INVITATION_INVALID', 404)
    const row = Array.isArray(existing) ? existing[0] : existing
    if (!row || row.status !== 'pending') return sendTeamError(res, 'INVITATION_INVALID', 404)
    if (normalizeEmail(profile.email) !== row.email) return sendTeamError(res, 'EMAIL_MISMATCH', 403)

    const { error } = await db.from('team_invitations').update({ status: 'cancelled' }).eq('id', row.id)
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message })

    res.json({ ok: true })
  })

  return router
}
