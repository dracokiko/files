-- Tracks the last time a user changed their institution/course/year from
-- the Settings page, so backend/routes/profile.js can enforce: unlimited
-- changes in the first 24h after signup (fixing a wrong choice at
-- registration), then at most one change every 30 days after that.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS course_changed_at TIMESTAMPTZ;
