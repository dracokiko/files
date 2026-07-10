-- Adds year/semester/elective metadata to cadeiras so the real
-- faculdades/cursos/cadeiras tables can back the year-filtered subject
-- picker that the frontend already expects (previously 100% hardcoded).
-- Additive only — safe to run against the live DB.

ALTER TABLE cadeiras
  ADD COLUMN IF NOT EXISTS year            INTEGER,
  ADD COLUMN IF NOT EXISTS year_label      TEXT,
  ADD COLUMN IF NOT EXISTS semester        INTEGER,
  ADD COLUMN IF NOT EXISTS semester_label  TEXT,
  ADD COLUMN IF NOT EXISTS is_optional     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS optional_group  TEXT;

CREATE INDEX IF NOT EXISTS idx_cadeiras_curso_year ON cadeiras (curso_id, year);
