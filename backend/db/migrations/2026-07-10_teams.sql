-- ============================================================
-- AulaIQ — Team plan: teams, membership, invitations
-- Run this in the Supabase SQL editor:
-- Dashboard → SQL Editor → New Query → paste → Run
--
-- Access model: these tables are written/read exclusively by the Express
-- backend using the service-role key (see backend/routes/team.js), never
-- directly by the browser with the anon/authenticated key. RLS is enabled
-- with NO permissive policies (deny-by-default for anon/authenticated);
-- the service role bypasses RLS entirely, so functionality is unaffected.
-- Table grants and RPC EXECUTE grants are revoked from anon/authenticated
-- for defense in depth on top of RLS.
--
-- Seat limit: 1 admin (owner) + up to 4 invited members = 5 seats total.
-- The canonical value lives in backend/config/team.js (TEAM_MAX_SEATS) and
-- src/config/team.ts on the frontend — this migration seeds teams.seats_total
-- from that same number (5) but does not hardcode it as an immutable CHECK,
-- so a future pricing tier isn't blocked at the schema level.
-- ============================================================

-- Supabase installs pgcrypto into the "extensions" schema, not "public".
-- Every SECURITY DEFINER function below pins search_path explicitly (to
-- resist search-path hijacking) as `public, extensions` specifically so
-- digest()/gen_random_bytes() stay resolvable — dropping the ", extensions"
-- reintroduces "function digest(...) does not exist" at call time.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Defined in backend/db/profiles_schema.sql already, but that file may not
-- have been re-run on every environment this migration lands on — CREATE OR
-- REPLACE makes redefining it here a safe no-op either way.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── teams ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT         NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  owner_id                UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  subscription_status     TEXT         NOT NULL DEFAULT 'inactive'
                                        CHECK (subscription_status IN (
                                          'active', 'trialing', 'past_due', 'canceled',
                                          'incomplete', 'incomplete_expired', 'unpaid', 'inactive'
                                        )),
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN      NOT NULL DEFAULT FALSE,
  seats_total             INTEGER      NOT NULL DEFAULT 5 CHECK (seats_total >= 1),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_owner              ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_stripe_customer     ON teams(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_teams_stripe_subscription ON teams(stripe_subscription_id);

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── team_members ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT         NOT NULL CHECK (role IN ('admin', 'member')),
  status      TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- A user can only be an active member (admin or invited) of one team at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_one_active_team_per_user
  ON team_members(user_id) WHERE status = 'active';

-- A team has exactly one active admin (the owner). Prevents a second admin
-- row from ever being inserted, even by a bug — ownership transfer is a
-- separate, explicit operation (update the existing admin row + teams.owner_id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_one_active_admin_per_team
  ON team_members(team_id) WHERE status = 'active' AND role = 'admin';

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── team_invitations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invitations (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email        TEXT         NOT NULL CHECK (email = lower(btrim(email))),
  invited_by   UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  -- SHA-256 hex of the plaintext token mailed to the invitee. The plaintext
  -- token only ever exists in the RPC response used to compose that one
  -- email and is never persisted or logged (see team_create_invitation()).
  token_hash   TEXT         NOT NULL UNIQUE,
  status       TEXT         NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at   TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at  TIMESTAMPTZ,
  accepted_by  UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team   ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email  ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- Only one pending invitation per (team, email) at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_one_pending_per_email
  ON team_invitations(team_id, email) WHERE status = 'pending';

CREATE TRIGGER team_invitations_updated_at
  BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS: enabled, deny-by-default for anon/authenticated ─────────────────
-- Only the service role (used exclusively by the Express backend) may touch
-- these tables. No policies are created for anon/authenticated on purpose.
ALTER TABLE teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON teams            FROM anon, authenticated;
REVOKE ALL ON team_members     FROM anon, authenticated;
REVOKE ALL ON team_invitations FROM anon, authenticated;

-- ============================================================
-- Concurrency-safe seat management
--
-- Both invite-creation and invite-acceptance are the two points where two
-- concurrent requests could otherwise both "see" a free seat and both
-- succeed, overshooting seats_total. Each function locks the team row
-- (SELECT ... FOR UPDATE) before counting occupied seats, so concurrent
-- callers serialize on that lock instead of racing.
-- ============================================================

-- Occupied seats = active members (including the admin) + pending invites
-- that haven't expired. Pending invites reserve a seat so an admin can't
-- invite past the limit and then have every invite "land" over capacity.
CREATE OR REPLACE FUNCTION team_occupied_seats(p_team_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND status = 'active')
    +
    (SELECT COUNT(*) FROM team_invitations
       WHERE team_id = p_team_id AND status = 'pending' AND expires_at > NOW());
$$;

-- Creates a pending invitation. Raises a SQLSTATE-tagged exception (message
-- text is the machine-readable error code the Express layer maps to a
-- user-facing message) for every business-rule violation instead of letting
-- a generic constraint violation leak through.
CREATE OR REPLACE FUNCTION team_create_invitation(p_team_id UUID, p_admin_id UUID, p_email TEXT)
RETURNS TABLE (
  id UUID, team_id UUID, email TEXT, status TEXT,
  expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ, token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email       TEXT := lower(btrim(p_email));
  v_admin_email TEXT;
  v_seats_total INTEGER;
  v_token       TEXT;
BEGIN
  -- Lock the team row so concurrent invites/accepts on it serialize.
  PERFORM 1 FROM teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = p_admin_id AND role = 'admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'TEAM_ADMIN_REQUIRED';
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  SELECT email INTO v_admin_email FROM profiles WHERE id = p_admin_id;
  IF v_admin_email IS NOT NULL AND lower(v_admin_email) = v_email THEN
    RAISE EXCEPTION 'CANNOT_INVITE_SELF';
  END IF;

  IF EXISTS (
    SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.status = 'active' AND lower(p.email) = v_email
  ) THEN
    RAISE EXCEPTION 'USER_ALREADY_TEAM_MEMBER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM team_invitations
    WHERE team_id = p_team_id AND email = v_email AND status = 'pending' AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_PENDING';
  END IF;

  SELECT t.seats_total INTO v_seats_total FROM teams t WHERE t.id = p_team_id;
  IF team_occupied_seats(p_team_id) >= v_seats_total THEN
    RAISE EXCEPTION 'TEAM_MEMBER_LIMIT_REACHED';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  RETURN QUERY
    INSERT INTO team_invitations (team_id, email, invited_by, token_hash)
    VALUES (p_team_id, v_email, p_admin_id, encode(digest(v_token, 'sha256'), 'hex'))
    RETURNING team_invitations.id, team_invitations.team_id, team_invitations.email,
              team_invitations.status, team_invitations.expires_at, team_invitations.created_at,
              v_token;
END;
$$;

REVOKE ALL ON FUNCTION team_create_invitation(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION team_create_invitation(UUID, UUID, TEXT) TO service_role;

-- Accepts an invitation on behalf of the authenticated user (p_user_id is
-- always the Express-verified req.userId, never client-supplied).
CREATE OR REPLACE FUNCTION team_accept_invitation(p_token TEXT, p_user_id UUID)
RETURNS TABLE (team_id UUID, team_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invitation  team_invitations%ROWTYPE;
  v_user_email  TEXT;
  v_seats_total INTEGER;
BEGIN
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;

  -- Lock the parent team row for the rest of this transaction.
  PERFORM 1 FROM teams WHERE id = v_invitation.team_id FOR UPDATE;

  IF v_invitation.status = 'accepted' THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_ACCEPTED';
  ELSIF v_invitation.status = 'cancelled' THEN
    RAISE EXCEPTION 'INVITATION_CANCELLED';
  ELSIF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    UPDATE team_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;

  SELECT lower(email) INTO v_user_email FROM profiles WHERE id = p_user_id;
  IF v_user_email IS NULL OR v_user_email <> v_invitation.email THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH';
  END IF;

  IF EXISTS (SELECT 1 FROM team_members WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'ALREADY_IN_TEAM';
  END IF;

  IF (SELECT subscription_status FROM teams WHERE id = v_invitation.team_id) NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE';
  END IF;

  -- Re-check against *active members only* (not team_occupied_seats, which
  -- also counts this very pending invite) — is there still a free seat for
  -- the admin count + already-active members, now that this invite is being
  -- consumed?
  SELECT seats_total INTO v_seats_total FROM teams WHERE id = v_invitation.team_id;
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = v_invitation.team_id AND status = 'active') >= v_seats_total THEN
    RAISE EXCEPTION 'TEAM_MEMBER_LIMIT_REACHED';
  END IF;

  INSERT INTO team_members (team_id, user_id, role, status)
  VALUES (v_invitation.team_id, p_user_id, 'member', 'active');

  -- Academic feature gating everywhere else in the app reads profiles.plan
  -- (see aulaiq/src/components/Dashboard.tsx isPaidPlan) — grant it here so
  -- a new team member doesn't need every consumer of that check rewritten
  -- to also understand team_members. Reverted on removal/leave and on
  -- subscription cancellation (see routes/team.js and stripe-webhook).
  UPDATE profiles SET plan = 'team' WHERE id = p_user_id;

  UPDATE team_invitations
  SET status = 'accepted', accepted_at = NOW(), accepted_by = p_user_id
  WHERE id = v_invitation.id;

  RETURN QUERY
    SELECT t.id, t.name FROM teams t WHERE t.id = v_invitation.team_id;
END;
$$;

REVOKE ALL ON FUNCTION team_accept_invitation(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION team_accept_invitation(TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION team_occupied_seats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION team_occupied_seats(UUID) TO service_role;

-- Looks an invitation up by its plaintext token without ever selecting
-- token_hash back out. Used by (a) the public "you've been invited" info
-- screen before login, and (b) the decline action — both need the
-- invitation id/status/team without going through the accept transaction.
CREATE OR REPLACE FUNCTION team_invitation_lookup(p_token TEXT)
RETURNS TABLE (
  id UUID, team_id UUID, email TEXT, status TEXT, expires_at TIMESTAMPTZ,
  team_name TEXT, inviter_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
  SELECT
    ti.id, ti.team_id, ti.email,
    CASE WHEN ti.status = 'pending' AND ti.expires_at <= NOW() THEN 'expired' ELSE ti.status END,
    ti.expires_at, t.name, p.name
  FROM team_invitations ti
  JOIN teams t ON t.id = ti.team_id
  LEFT JOIN profiles p ON p.id = ti.invited_by
  WHERE ti.token_hash = encode(digest(p_token, 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION team_invitation_lookup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION team_invitation_lookup(TEXT) TO service_role;

-- Same acceptance flow as team_accept_invitation(), but keyed by invitation
-- id instead of the plaintext token — powers "you have a pending invite"
-- accept/decline directly from the dashboard's no-team state, where the
-- user is already authenticated and the token (only ever stored hashed)
-- isn't available to look up.
CREATE OR REPLACE FUNCTION team_accept_invitation_by_id(p_invitation_id UUID, p_user_id UUID)
RETURNS TABLE (team_id UUID, team_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invitation  team_invitations%ROWTYPE;
  v_user_email  TEXT;
  v_seats_total INTEGER;
BEGIN
  SELECT * INTO v_invitation FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;

  PERFORM 1 FROM teams WHERE id = v_invitation.team_id FOR UPDATE;

  IF v_invitation.status = 'accepted' THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_ACCEPTED';
  ELSIF v_invitation.status = 'cancelled' THEN
    RAISE EXCEPTION 'INVITATION_CANCELLED';
  ELSIF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    UPDATE team_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;

  SELECT lower(email) INTO v_user_email FROM profiles WHERE id = p_user_id;
  IF v_user_email IS NULL OR v_user_email <> v_invitation.email THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH';
  END IF;

  IF EXISTS (SELECT 1 FROM team_members WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'ALREADY_IN_TEAM';
  END IF;

  IF (SELECT subscription_status FROM teams WHERE id = v_invitation.team_id) NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE';
  END IF;

  SELECT seats_total INTO v_seats_total FROM teams WHERE id = v_invitation.team_id;
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = v_invitation.team_id AND status = 'active') >= v_seats_total THEN
    RAISE EXCEPTION 'TEAM_MEMBER_LIMIT_REACHED';
  END IF;

  INSERT INTO team_members (team_id, user_id, role, status)
  VALUES (v_invitation.team_id, p_user_id, 'member', 'active');

  -- Academic feature gating everywhere else in the app reads profiles.plan
  -- (see aulaiq/src/components/Dashboard.tsx isPaidPlan) — grant it here so
  -- a new team member doesn't need every consumer of that check rewritten
  -- to also understand team_members. Reverted on removal/leave and on
  -- subscription cancellation (see routes/team.js and stripe-webhook).
  UPDATE profiles SET plan = 'team' WHERE id = p_user_id;

  UPDATE team_invitations
  SET status = 'accepted', accepted_at = NOW(), accepted_by = p_user_id
  WHERE id = v_invitation.id;

  RETURN QUERY
    SELECT t.id, t.name FROM teams t WHERE t.id = v_invitation.team_id;
END;
$$;

REVOKE ALL ON FUNCTION team_accept_invitation_by_id(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION team_accept_invitation_by_id(UUID, UUID) TO service_role;
