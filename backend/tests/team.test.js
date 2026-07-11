/**
 * Unit tests for backend/services/team.js
 * Run: node backend/tests/team.test.js
 *
 * Pure-logic only — no live Supabase/DB. Concurrency-safe seat enforcement
 * itself lives in Postgres (team_create_invitation / team_accept_invitation
 * in backend/db/migrations/2026-07-10_teams.sql) and needs a real database
 * to exercise; that's out of scope for this zero-dependency test file (see
 * the PR report for what still needs a staging Supabase project to verify).
 */

import { strict as assert } from 'assert'
import {
  normalizeEmail, isValidEmail, validateTeamName, computeSeats,
  extractTeamErrorCode, teamErrorResponse, mapMemberRow, mapInvitationRow, mapTeamRow,
  TEAM_MAX_SEATS, TEAM_MAX_INVITED_MEMBERS,
} from '../services/team.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

console.log('\n── services/team.js ─────────────────────────')

test('seat config: admin + 4 invited = 5 total', () => {
  assert.equal(TEAM_MAX_INVITED_MEMBERS, 4)
  assert.equal(TEAM_MAX_SEATS, 5)
})

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com')
  assert.equal(normalizeEmail(undefined), '')
})

test('isValidEmail accepts a plausible email', () => {
  assert.equal(isValidEmail('a@b.co'), true)
})

test('isValidEmail rejects missing @ or domain', () => {
  assert.equal(isValidEmail('not-an-email'), false)
  assert.equal(isValidEmail('a@b'), false)
  assert.equal(isValidEmail(''), false)
})

test('validateTeamName rejects too short / too long, trims', () => {
  assert.equal(validateTeamName('a').valid, false)
  assert.equal(validateTeamName('a'.repeat(61)).valid, false)
  const ok = validateTeamName('  Equipa de Química  ')
  assert.equal(ok.valid, true)
  assert.equal(ok.value, 'Equipa de Química')
})

test('computeSeats: admin alone leaves 4 available', () => {
  const { seatsUsed, seatsAvailable } = computeSeats({
    activeMemberCount: 1, pendingInvitationCount: 0, seatsTotal: TEAM_MAX_SEATS,
  })
  assert.equal(seatsUsed, 1)
  assert.equal(seatsAvailable, 4)
})

test('computeSeats: pending invitations reserve a seat', () => {
  const { seatsUsed, seatsAvailable } = computeSeats({
    activeMemberCount: 1, pendingInvitationCount: 4, seatsTotal: TEAM_MAX_SEATS,
  })
  assert.equal(seatsUsed, 5)
  assert.equal(seatsAvailable, 0)
})

test('computeSeats never returns a negative seatsAvailable', () => {
  const { seatsAvailable } = computeSeats({
    activeMemberCount: 5, pendingInvitationCount: 3, seatsTotal: TEAM_MAX_SEATS,
  })
  assert.equal(seatsAvailable, 0)
})

test('extractTeamErrorCode recognizes known codes, rejects unknown text', () => {
  assert.equal(extractTeamErrorCode('TEAM_MEMBER_LIMIT_REACHED'), 'TEAM_MEMBER_LIMIT_REACHED')
  assert.equal(extractTeamErrorCode('duplicate key value violates unique constraint'), null)
  assert.equal(extractTeamErrorCode(undefined), null)
})

test('teamErrorResponse maps a known code to its status/message, unknown to 500', () => {
  const known = teamErrorResponse('TEAM_ADMIN_REQUIRED', 403)
  assert.equal(known.status, 403)
  assert.equal(known.body.error, 'TEAM_ADMIN_REQUIRED')
  assert.ok(known.body.message.length > 0)

  const unknown = teamErrorResponse('something_unmapped', 400)
  assert.equal(unknown.status, 500)
  assert.equal(unknown.body.error, 'UNKNOWN_ERROR')
})

test('mapMemberRow flags the current user and passes through role/status', () => {
  const row = {
    id: 'm1', user_id: 'u1', role: 'admin', status: 'active', joined_at: '2026-01-01T00:00:00Z',
    profiles: { name: 'Ana', email: 'ana@example.com' },
  }
  const mapped = mapMemberRow(row, 'u1')
  assert.equal(mapped.isCurrentUser, true)
  assert.equal(mapped.name, 'Ana')
  assert.equal(mapped.role, 'admin')

  const other = mapMemberRow(row, 'someone-else')
  assert.equal(other.isCurrentUser, false)
})

test('mapInvitationRow never includes a token field', () => {
  const row = {
    id: 'i1', email: 'x@y.com', status: 'pending',
    expires_at: '2026-01-08T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
    token_hash: 'should-never-leak',
  }
  const mapped = mapInvitationRow(row)
  assert.equal('token' in mapped, false)
  assert.equal('token_hash' in mapped, false)
})

test('mapTeamRow reports the caller role and computed seat numbers', () => {
  const row = {
    id: 't1', name: 'Equipa X', subscription_status: 'active',
    current_period_end: null, cancel_at_period_end: false,
    seats_total: 5, stripe_customer_id: 'cus_123',
  }
  const mapped = mapTeamRow(row, { role: 'member', seatsUsed: 3, seatsAvailable: 2 })
  assert.equal(mapped.plan, 'team')
  assert.equal(mapped.currentUserRole, 'member')
  assert.equal(mapped.seatsUsed, 3)
  assert.equal(mapped.seatsAvailable, 2)
  assert.equal(mapped.hasStripeCustomer, true)
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
