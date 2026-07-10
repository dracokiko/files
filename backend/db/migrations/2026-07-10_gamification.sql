-- Server-validated gamification: XP, badges, buddies, challenges, quizzes.
-- Replaces the previous localStorage-only implementation. Additive only —
-- safe to run against the live DB. Access goes through Express with the
-- service-role key + requireUser, not directly from the browser, so RLS
-- here is permissive (matching the existing precedent on chunks/documents).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS global_xp                INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_current            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_active_date   DATE;

CREATE TABLE IF NOT EXISTS user_subject_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cadeira_id        UUID NOT NULL REFERENCES cadeiras(id) ON DELETE CASCADE,
  xp                INTEGER NOT NULL DEFAULT 0,
  correct_answers   INTEGER NOT NULL DEFAULT 0,
  total_answers     INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cadeira_id)
);

CREATE TABLE IF NOT EXISTS user_chapter_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chapter_id        UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  cadeira_id        UUID NOT NULL REFERENCES cadeiras(id) ON DELETE CASCADE,
  xp                INTEGER NOT NULL DEFAULT 0,
  correct_answers   INTEGER NOT NULL DEFAULT 0,
  wrong_answers     INTEGER NOT NULL DEFAULT 0,
  attempts_count     INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS earned_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

-- Real mutual buddy links. No request/accept state machine — adding a
-- buddy by email links both directions immediately, like adding a contact.
CREATE TABLE IF NOT EXISTS buddies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buddy_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id <> buddy_user_id),
  UNIQUE (user_id, buddy_user_id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cadeira_id    UUID NOT NULL REFERENCES cadeiras(id) ON DELETE CASCADE,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'seen')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS quiz_sets (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadeira_id             UUID NOT NULL REFERENCES cadeiras(id) ON DELETE CASCADE,
  chapter_id             UUID REFERENCES chapters(id) ON DELETE SET NULL,
  generated_for_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source_chunk_ids       UUID[] NOT NULL DEFAULT '{}',
  model                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_set_id    UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  question       TEXT NOT NULL,
  options        TEXT[] NOT NULL,
  correct_index  SMALLINT NOT NULL,
  explanation    TEXT,
  UNIQUE (quiz_set_id, ordinal)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_set_id    UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers        SMALLINT[] NOT NULL DEFAULT '{}',
  correct_count  INTEGER,
  xp_awarded     INTEGER,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_set_id, user_id)
);

ALTER TABLE user_subject_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE earned_badges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies                ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges              ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts               ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON user_subject_progress FOR ALL USING (true);
CREATE POLICY "service_role_all" ON user_chapter_progress FOR ALL USING (true);
CREATE POLICY "service_role_all" ON earned_badges         FOR ALL USING (true);
CREATE POLICY "service_role_all" ON buddies                FOR ALL USING (true);
CREATE POLICY "service_role_all" ON challenges              FOR ALL USING (true);
CREATE POLICY "service_role_all" ON quiz_sets                 FOR ALL USING (true);
CREATE POLICY "service_role_all" ON quiz_questions             FOR ALL USING (true);
CREATE POLICY "service_role_all" ON quiz_attempts               FOR ALL USING (true);
