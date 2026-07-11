-- Adds a duration (in years) to cursos so the year picker at registration
-- has something to fall back on before any cadeiras with year data exist.
-- Additive only — safe to run against the live DB.

ALTER TABLE cursos
  ADD COLUMN IF NOT EXISTS duracao_anos INTEGER NOT NULL DEFAULT 3;
