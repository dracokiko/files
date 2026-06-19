-- ============================================================
-- AulaIQ — Knowledge Graph v2 Migration
-- Run AFTER knowledge_v2_schema.sql and knowledge_v2_rpc.sql
-- Safe: uses ADD COLUMN IF NOT EXISTS throughout
-- ============================================================

-- ── Phase 1: Tenancy & access control ────────────────────────

-- Add subject_id, visibility, plan_access_level to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS subject_id    UUID  REFERENCES cadeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id     TEXT,
  ADD COLUMN IF NOT EXISTS visibility    TEXT  NOT NULL DEFAULT 'private'
                                          CHECK (visibility IN ('public','private','tenant')),
  ADD COLUMN IF NOT EXISTS plan_access_level TEXT NOT NULL DEFAULT 'free'
                                          CHECK (plan_access_level IN ('free','trial','monthly','semester'));

-- Add tenant propagation to chunks for fast RLS-ready filters
ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS subject_id    UUID  REFERENCES cadeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id     TEXT;

-- Add subject_id to concepts for tenant isolation
ALTER TABLE concepts
  ADD COLUMN IF NOT EXISTS subject_id    UUID  REFERENCES cadeiras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_subject  ON documents (subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant   ON documents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chunks_subject     ON chunks (subject_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tenant      ON chunks (tenant_id);

-- ── Phase 2: Document versioning improvements ─────────────────

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS content_hash            TEXT,
  ADD COLUMN IF NOT EXISTS original_file_path      TEXT,
  ADD COLUMN IF NOT EXISTS is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chunker_version         TEXT,
  ADD COLUMN IF NOT EXISTS concept_extractor_version TEXT,
  ADD COLUMN IF NOT EXISTS embedding_model         TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dim           INT,
  ADD COLUMN IF NOT EXISTS reprocess_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supersedes_version_id   UUID REFERENCES document_versions(id);

CREATE INDEX IF NOT EXISTS idx_docversions_active ON document_versions (document_id, is_active)
  WHERE is_active = TRUE;

-- ── Phase 3: Job runner — robust locking & state ─────────────

ALTER TABLE ingestion_jobs
  ADD COLUMN IF NOT EXISTS locked_by        TEXT,
  ADD COLUMN IF NOT EXISTS locked_until     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS current_step     TEXT,
  ADD COLUMN IF NOT EXISTS payload          JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS result           JSONB,
  ADD COLUMN IF NOT EXISTS last_error       TEXT,
  ADD COLUMN IF NOT EXISTS max_attempts     INT NOT NULL DEFAULT 3;

-- Update status enum to include 'retrying' and 'cancelled'
-- Supabase doesn't support ALTER TYPE on CHECK constraints easily;
-- add the new values via a function check workaround:
ALTER TABLE ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_status_check;
ALTER TABLE ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_status_check
  CHECK (status IN ('queued','running','retrying','failed','succeeded','needs_review','cancelled'));

CREATE INDEX IF NOT EXISTS idx_jobs_queued ON ingestion_jobs (status, created_at)
  WHERE status IN ('queued','retrying');
CREATE INDEX IF NOT EXISTS idx_jobs_locked ON ingestion_jobs (locked_until)
  WHERE locked_until IS NOT NULL;

-- ── Phase 4: Parent-child chunk linking ───────────────────────

ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS previous_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_chunk_id     UUID REFERENCES chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_span_start INT,
  ADD COLUMN IF NOT EXISTS source_span_end   INT;

CREATE INDEX IF NOT EXISTS idx_chunks_prev ON chunks (previous_chunk_id) WHERE previous_chunk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_next ON chunks (next_chunk_id)     WHERE next_chunk_id IS NOT NULL;

-- ── Phase 6: Formula metadata improvements ────────────────────

ALTER TABLE formulas
  ADD COLUMN IF NOT EXISTS formula_kind     TEXT NOT NULL DEFAULT 'unknown'
                                             CHECK (formula_kind IN ('equation','inequality','definition','derivation','correlation','identity','unknown')),
  ADD COLUMN IF NOT EXISTS formula_description TEXT,
  ADD COLUMN IF NOT EXISTS formula_context  TEXT,
  ADD COLUMN IF NOT EXISTS formula_variables JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS formula_units    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS concept_ids      UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_formulas_kind ON formulas (formula_kind);

-- ── Phase 7: Table handling ───────────────────────────────────

CREATE TABLE IF NOT EXISTS document_tables (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id          UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  table_markdown    TEXT NOT NULL,
  table_text        TEXT NOT NULL,
  table_caption     TEXT,
  table_context     TEXT,
  source_page       INT,
  ordinal_in_chunk  INT NOT NULL DEFAULT 0,
  fts_vector        TSVECTOR,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dtables_chunk   ON document_tables (chunk_id);
CREATE INDEX IF NOT EXISTS idx_dtables_version ON document_tables (document_version_id);
CREATE INDEX IF NOT EXISTS idx_dtables_fts     ON document_tables USING GIN (fts_vector);

CREATE OR REPLACE FUNCTION document_tables_fts_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.table_caption, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.table_text,    '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_tables_fts_trigger ON document_tables;
CREATE TRIGGER document_tables_fts_trigger
  BEFORE INSERT OR UPDATE OF table_text, table_caption ON document_tables
  FOR EACH ROW EXECUTE FUNCTION document_tables_fts_update();

-- ── Phase 8: Concept canonicalization helpers ─────────────────

CREATE TABLE IF NOT EXISTS concept_merge_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  merge_reason      TEXT,
  confidence        NUMERIC(5,4) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','rejected','deferred')),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_concept_id, target_concept_id)
);

-- ── Phase 10: Enhanced concept relations ─────────────────────

ALTER TABLE concept_relations
  ADD COLUMN IF NOT EXISTS direction    TEXT NOT NULL DEFAULT 'directed'
                                         CHECK (direction IN ('directed','bidirectional')),
  ADD COLUMN IF NOT EXISTS created_by   TEXT NOT NULL DEFAULT 'ai'
                                         CHECK (created_by IN ('ai','admin','system')),
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT TRUE;

-- Extend relation types
ALTER TABLE concept_relations
  DROP CONSTRAINT IF EXISTS concept_relations_relation_type_check;
ALTER TABLE concept_relations
  ADD CONSTRAINT concept_relations_relation_type_check
  CHECK (relation_type IN (
    'same_as','broader_than','narrower_than','prerequisite_of','used_with',
    'derived_from','defined_by','contrasts_with','appears_with',
    'uses','depends_on','special_case_of','applied_in','belongs_to',
    'explained_by','formula_for'
  ));

CREATE INDEX IF NOT EXISTS idx_relations_active ON concept_relations (source_concept_id, relation_type)
  WHERE is_active = TRUE;

-- ── Phase 11: Retrieval & answer logging ─────────────────────

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query             TEXT NOT NULL,
  query_parsed      JSONB NOT NULL DEFAULT '{}',
  user_id           TEXT,
  subject_id        UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  course_id         UUID REFERENCES courses(id)  ON DELETE SET NULL,
  tenant_id         TEXT,
  candidate_count   INT,
  final_count       INT,
  top_chunk_ids     UUID[],
  latency_ms        INT,
  embedding_latency_ms INT,
  fts_count         INT,
  vector_count      INT,
  concept_count     INT,
  formula_count     INT,
  zero_results      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retrieval_log_id  UUID REFERENCES retrieval_logs(id) ON DELETE SET NULL,
  query             TEXT NOT NULL,
  answer_text       TEXT NOT NULL,
  answer_model      TEXT,
  cited_chunk_ids   UUID[],
  prompt_token_count INT,
  answer_token_count INT,
  guardrail_flags   JSONB NOT NULL DEFAULT '[]',
  latency_ms        INT,
  user_id           TEXT,
  subject_id        UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  tenant_id         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_logs_subject ON retrieval_logs (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_zero    ON retrieval_logs (zero_results, created_at DESC)
  WHERE zero_results = TRUE;
CREATE INDEX IF NOT EXISTS idx_answer_logs_retrieval  ON answer_logs (retrieval_log_id);
CREATE INDEX IF NOT EXISTS idx_answer_logs_subject    ON answer_logs (subject_id, created_at DESC);

-- ── Phase 12: Feedback ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS query_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_log_id    UUID REFERENCES answer_logs(id) ON DELETE SET NULL,
  retrieval_log_id UUID REFERENCES retrieval_logs(id) ON DELETE SET NULL,
  user_id          TEXT,
  query            TEXT,
  feedback_type    TEXT NOT NULL
                   CHECK (feedback_type IN (
                     'thumbs_up','thumbs_down','wrong_chapter','missing_formula',
                     'too_long','too_short','hallucinated','irrelevant','useful','other'
                   )),
  feedback_text    TEXT,
  retrieved_chunk_ids UUID[],
  subject_id       UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  tenant_id        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_subject ON query_feedback (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_type    ON query_feedback (feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_answer  ON query_feedback (answer_log_id);

-- ── Phase 1: RLS policy templates ────────────────────────────
-- Enable RLS but keep it permissive for now (until user auth is wired).
-- After auth integration is complete, replace the permissive policies.

ALTER TABLE chunks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_logs     ENABLE ROW LEVEL SECURITY;

-- Permissive policies: authenticated service role bypasses RLS.
-- TODO: When JWT auth is active, replace these with per-user policies.
-- DROP + CREATE is used because CREATE POLICY IF NOT EXISTS requires PG 15+.
DROP POLICY IF EXISTS "service_role_all_chunks"           ON chunks;
DROP POLICY IF EXISTS "service_role_all_documents"        ON documents;
DROP POLICY IF EXISTS "service_role_all_document_versions" ON document_versions;
DROP POLICY IF EXISTS "service_role_all_feedback"         ON query_feedback;
DROP POLICY IF EXISTS "service_role_all_retrieval_logs"   ON retrieval_logs;
DROP POLICY IF EXISTS "service_role_all_answer_logs"      ON answer_logs;

CREATE POLICY "service_role_all_chunks"
  ON chunks FOR ALL USING (true);

CREATE POLICY "service_role_all_documents"
  ON documents FOR ALL USING (true);

CREATE POLICY "service_role_all_document_versions"
  ON document_versions FOR ALL USING (true);

CREATE POLICY "service_role_all_feedback"
  ON query_feedback FOR ALL USING (true);

CREATE POLICY "service_role_all_retrieval_logs"
  ON retrieval_logs FOR ALL USING (true);

CREATE POLICY "service_role_all_answer_logs"
  ON answer_logs FOR ALL USING (true);

-- ── Reprocess helper function ─────────────────────────────────

CREATE OR REPLACE FUNCTION mark_version_for_reprocess(p_version_id UUID, p_step TEXT DEFAULT 'all')
RETURNS void AS $$
BEGIN
  UPDATE document_versions
  SET
    status = 'processing',
    reprocess_requested_at = NOW(),
    is_active = FALSE
  WHERE id = p_version_id;

  INSERT INTO ingestion_jobs (document_version_id, job_type, status, payload)
  VALUES (p_version_id, 'parse', 'queued', jsonb_build_object('reprocess_step', p_step));
END;
$$ LANGUAGE plpgsql;

-- ── FTS search update to include table captions ───────────────

CREATE OR REPLACE FUNCTION fts_search_with_tables(
  query_text    text,
  p_course_id   uuid    DEFAULT NULL,
  p_document_id uuid    DEFAULT NULL,
  p_chunk_types text[]  DEFAULT NULL,
  p_limit       int     DEFAULT 30
)
RETURNS TABLE (chunk_id uuid, score float4, source text) AS $$
BEGIN
  -- Chunk FTS
  RETURN QUERY
  SELECT
    c.id,
    ts_rank_cd(c.fts_vector, websearch_to_tsquery('pg_catalog.portuguese', query_text), 32)::float4,
    'chunk'::text
  FROM chunks c
  JOIN document_versions dv ON dv.id = c.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE
    c.fts_vector @@ websearch_to_tsquery('pg_catalog.portuguese', query_text)
    AND dv.status NOT IN ('superseded', 'failed')
    AND dv.is_active = TRUE
    AND (p_course_id IS NULL  OR d.course_id   = p_course_id)
    AND (p_document_id IS NULL OR d.id          = p_document_id)
    AND (p_chunk_types IS NULL OR c.chunk_type  = ANY(p_chunk_types))

  UNION ALL

  -- Table FTS (returns chunk_id of parent chunk)
  SELECT
    dt.chunk_id,
    ts_rank_cd(dt.fts_vector, websearch_to_tsquery('pg_catalog.portuguese', query_text), 32)::float4 * 0.8,
    'table'::text
  FROM document_tables dt
  JOIN document_versions dv ON dv.id = dt.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE
    dt.fts_vector @@ websearch_to_tsquery('pg_catalog.portuguese', query_text)
    AND dv.is_active = TRUE
    AND (p_course_id IS NULL OR d.course_id = p_course_id)
    AND (p_document_id IS NULL OR d.id      = p_document_id)

  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
