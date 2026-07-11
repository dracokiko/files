/**
 * Pure Team-plan logic: validation, row → API-shape mapping, permission
 * checks. Kept free of Supabase/Express so it's unit-testable in isolation
 * (see backend/tests/team.test.js), mirroring the split already used for
 * gamification (services/xp.js vs routes/gamification.js).
 */
import { TEAM_MAX_SEATS, TEAM_MAX_INVITED_MEMBERS } from '../config/team.js'

export { TEAM_MAX_SEATS, TEAM_MAX_INVITED_MEMBERS }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function isValidEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email))
}

export function validateTeamName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed.length < 2) return { valid: false, error: 'TEAM_NAME_TOO_SHORT' }
  if (trimmed.length > 60) return { valid: false, error: 'TEAM_NAME_TOO_LONG' }
  return { valid: true, value: trimmed }
}

// pt-PT human fallback for every machine-readable error code this module's
// routes can raise (directly, or forwarded from the DB RPC exception message).
export const TEAM_ERROR_MESSAGES = {
  TEAM_NOT_FOUND: 'Equipa não encontrada.',
  TEAM_ADMIN_REQUIRED: 'Apenas o administrador da equipa pode fazer isto.',
  INVALID_EMAIL: 'Introduz um email válido.',
  CANNOT_INVITE_SELF: 'Não podes convidar-te a ti próprio.',
  USER_ALREADY_TEAM_MEMBER: 'Este email já pertence à equipa.',
  INVITATION_ALREADY_PENDING: 'Já existe um convite pendente para este email.',
  TEAM_MEMBER_LIMIT_REACHED: 'A equipa já tem o número máximo de lugares ocupados.',
  SUBSCRIPTION_INACTIVE: 'A subscrição da equipa não está ativa.',
  INVITATION_INVALID: 'Este convite não é válido.',
  INVITATION_EXPIRED: 'Este convite expirou.',
  INVITATION_CANCELLED: 'Este convite foi cancelado.',
  INVITATION_ALREADY_ACCEPTED: 'Este convite já foi aceite.',
  EMAIL_MISMATCH: 'Este convite foi enviado para outro email.',
  ALREADY_IN_TEAM: 'Já pertences a uma equipa.',
  TEAM_NAME_TOO_SHORT: 'O nome da equipa deve ter pelo menos 2 caracteres.',
  TEAM_NAME_TOO_LONG: 'O nome da equipa não pode ter mais de 60 caracteres.',
  MEMBER_NOT_FOUND: 'Membro não encontrado.',
  CANNOT_REMOVE_ADMIN: 'O administrador não pode ser removido como um membro normal.',
  ADMIN_CANNOT_LEAVE: 'Como administrador, não podes simplesmente sair — transfere a propriedade ou contacta o suporte para dissolver a equipa.',
  NOT_TEAM_MEMBER: 'Não pertences a nenhuma equipa.',
}

/** Extracts a known TEAM_* error code from a raw Postgres/RPC error message. */
export function extractTeamErrorCode(message) {
  if (typeof message !== 'string') return null
  const code = message.trim()
  return code in TEAM_ERROR_MESSAGES ? code : null
}

export function teamErrorResponse(code, fallbackStatus = 400) {
  const known = code in TEAM_ERROR_MESSAGES
  return {
    status: known ? fallbackStatus : 500,
    body: { error: known ? code : 'UNKNOWN_ERROR', message: TEAM_ERROR_MESSAGES[code] ?? 'Algo correu mal.' },
  }
}

export function mapMemberRow(row, currentUserId) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.profiles?.name ?? null,
    email: row.profiles?.email ?? '',
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    isCurrentUser: row.user_id === currentUserId,
  }
}

export function mapInvitationRow(row) {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export function mapTeamRow(row, { role, seatsUsed, seatsAvailable }) {
  return {
    id: row.id,
    name: row.name,
    plan: 'team',
    subscriptionStatus: row.subscription_status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    seatsUsed,
    seatsTotal: row.seats_total,
    seatsAvailable,
    hasStripeCustomer: Boolean(row.stripe_customer_id),
    currentUserRole: role,
  }
}

export function computeSeats({ activeMemberCount, pendingInvitationCount, seatsTotal }) {
  const seatsUsed = activeMemberCount + pendingInvitationCount
  return {
    seatsUsed,
    seatsAvailable: Math.max(0, seatsTotal - seatsUsed),
  }
}
