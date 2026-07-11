-- Backfills the year/semester columns (added by
-- 2026-07-10_cadeiras_year_semester.sql) from the pre-existing ano/semestre
-- columns, which already hold the correct seeded curriculum data but were
-- never copied over — this is why the registration year picker showed
-- nothing for most degrees. Only fills rows where year is still unset, so
-- it never overwrites anything already assigned via the admin UI.
-- Additive/corrective only — safe to run against the live DB.

UPDATE cadeiras
SET
  year           = ano,
  year_label     = ano || 'º Ano',
  semester       = semestre,
  semester_label = semestre || 'º Semestre'
WHERE year IS NULL AND ano IS NOT NULL;
