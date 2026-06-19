-- ============================================================
-- AulaIQ — Knowledge Graph v2  (COMPLETE — single file)
-- Paste this entire file into Supabase SQL Editor and Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- ============================================================

-- ── 1. Extensions ────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── 2. Core tables ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  lang_code   TEXT NOT NULL DEFAULT 'pt-PT',
  cadeira_id  UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID REFERENCES courses(id) ON DELETE SET NULL,
  source_kind       TEXT NOT NULL CHECK (source_kind IN ('pdf','latex','docx','pptx','html','markdown','txt','image')),
  title             TEXT,
  original_filename TEXT,
  source_uri        TEXT,
  lang_code         TEXT NOT NULL DEFAULT 'pt-PT',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id             UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no              INT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'uploaded'
                          CHECK (status IN ('uploaded','processing','processed','failed','superseded','needs_review')),
  source_sha256           TEXT UNIQUE NOT NULL,
  parser_name             TEXT,
  parser_version          TEXT,
  page_count              INT,
  token_count             INT,
  ocr_used                BOOLEAN NOT NULL DEFAULT FALSE,
  formula_extraction_used BOOLEAN NOT NULL DEFAULT FALSE,
  source_metadata         JSONB NOT NULL DEFAULT '{}',
  parse_artifact          JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_no)
);

CREATE TABLE IF NOT EXISTS chapters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  chapter_no          INT NOT NULL,
  title               TEXT NOT NULL,
  summary             TEXT,
  page_start          INT,
  page_end            INT
);

CREATE TABLE IF NOT EXISTS sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE,
  chapter_id          UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  parent_section_id   UUID REFERENCES sections(id) ON DELETE SET NULL,
  section_level       SMALLINT NOT NULL,
  title               TEXT NOT NULL,
  heading_path        TEXT[] NOT NULL DEFAULT '{}',
  ordinal_in_chapter  INT NOT NULL,
  page_start          INT,
  page_end            INT
);

CREATE TABLE IF NOT EXISTS chunks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  chapter_id          UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  section_id          UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  chunk_no            INT NOT NULL,
  chunk_type          TEXT NOT NULL DEFAULT 'body'
                      CHECK (chunk_type IN ('body','definition','theorem','proof','example','exercise','solution','summary','table','caption','formula_only','list_item')),
  heading_path        TEXT[] NOT NULL DEFAULT '{}',
  content_markdown    TEXT NOT NULL,
  content_plain       TEXT NOT NULL,
  content_norm        TEXT NOT NULL,
  fts_vector          TSVECTOR,
  embedding           vector(768),
  token_count         INT NOT NULL,
  char_count          INT NOT NULL,
  page_start          INT,
  page_end            INT,
  dedupe_hash         TEXT NOT NULL,
  source_spans        JSONB NOT NULL DEFAULT '[]',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS formulas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id              UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  document_version_id   UUID REFERENCES document_versions(id) ON DELETE CASCADE,
  ordinal_in_chunk      INT NOT NULL,
  original_latex        TEXT NOT NULL,
  normalized_latex      TEXT NOT NULL,
  mathml                TEXT,
  formula_hash          TEXT NOT NULL,
  is_display            BOOLEAN NOT NULL DEFAULT TRUE,
  symbols               TEXT[] NOT NULL DEFAULT '{}',
  extraction_confidence NUMERIC(5,4) NOT NULL,
  page_no               INT,
  bbox                  JSONB
);

CREATE TABLE IF NOT EXISTS concepts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      UUID REFERENCES courses(id) ON DELETE SET NULL,
  canonical_name TEXT NOT NULL,
  concept_type   TEXT NOT NULL DEFAULT 'concept'
                 CHECK (concept_type IN ('concept','law','theorem','definition','method','formula_family','variable','operator','unit','exercise_type')),
  definition     TEXT,
  lang_code      TEXT NOT NULL DEFAULT 'pt-PT',
  confidence     NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id  UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  alias_text  TEXT NOT NULL,
  alias_norm  TEXT NOT NULL,
  alias_kind  TEXT NOT NULL DEFAULT 'exact_synonym'
              CHECK (alias_kind IN ('canonical','exact_synonym','abbreviation','symbol','formula_signature','lexical_variant','llm_inferred')),
  weight      NUMERIC(5,4) NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'course',
  is_curated  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_mentions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id    UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  chunk_id      UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  formula_id    UUID REFERENCES formulas(id) ON DELETE SET NULL,
  mention_kind  TEXT NOT NULL DEFAULT 'body'
                CHECK (mention_kind IN ('heading','definition_sentence','body','formula','table','caption','exercise')),
  evidence_text TEXT,
  offset_start  INT,
  offset_end    INT,
  confidence    NUMERIC(5,4) NOT NULL,
  extractor     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_relations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relation_type     TEXT NOT NULL
                    CHECK (relation_type IN (
                      'same_as','broader_than','narrower_than','prerequisite_of','used_with',
                      'derived_from','defined_by','contrasts_with','appears_with',
                      'uses','depends_on','special_case_of','applied_in','belongs_to',
                      'explained_by','formula_for'
                    )),
  evidence_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  confidence        NUMERIC(5,4) NOT NULL,
  extractor         TEXT NOT NULL,
  direction         TEXT NOT NULL DEFAULT 'directed' CHECK (direction IN ('directed','bidirectional')),
  created_by        TEXT NOT NULL DEFAULT 'ai' CHECK (created_by IN ('ai','admin','system')),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  job_type            TEXT NOT NULL
                      CHECK (job_type IN ('parse','chunk','embed','extract_concepts','validate','reindex')),
  status              TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','running','retrying','succeeded','failed','needs_review','cancelled')),
  attempt_no          INT NOT NULL DEFAULT 0,
  max_attempts        INT NOT NULL DEFAULT 3,
  locked_by           TEXT,
  locked_until        TIMESTAMPTZ,
  progress_percent    INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  current_step        TEXT,
  payload             JSONB NOT NULL DEFAULT '{}',
  result              JSONB,
  last_error          TEXT,
  metrics             JSONB NOT NULL DEFAULT '{}',
  error_payload       JSONB,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  severity         TEXT NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  issue_code       TEXT NOT NULL,
  message          TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Migration additions (safe if tables already exist) ─────

-- Phase 1: tenancy
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS subject_id        UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id         TEXT,
  ADD COLUMN IF NOT EXISTS visibility        TEXT NOT NULL DEFAULT 'private'
                                              CHECK (visibility IN ('public','private','tenant')),
  ADD COLUMN IF NOT EXISTS plan_access_level TEXT NOT NULL DEFAULT 'free'
                                              CHECK (plan_access_level IN ('free','trial','monthly','semester'));

ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS subject_id        UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id         TEXT,
  ADD COLUMN IF NOT EXISTS previous_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_chunk_id     UUID REFERENCES chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_span_start INT,
  ADD COLUMN IF NOT EXISTS source_span_end   INT;

ALTER TABLE concepts
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES cadeiras(id) ON DELETE SET NULL;

-- Phase 2: versioning
ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS content_hash              TEXT,
  ADD COLUMN IF NOT EXISTS original_file_path        TEXT,
  ADD COLUMN IF NOT EXISTS is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chunker_version           TEXT,
  ADD COLUMN IF NOT EXISTS concept_extractor_version TEXT,
  ADD COLUMN IF NOT EXISTS embedding_model           TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dim             INT,
  ADD COLUMN IF NOT EXISTS reprocess_requested_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supersedes_version_id     UUID REFERENCES document_versions(id);

-- Phase 6: formula metadata
ALTER TABLE formulas
  ADD COLUMN IF NOT EXISTS formula_kind        TEXT NOT NULL DEFAULT 'unknown'
                                               CHECK (formula_kind IN ('equation','inequality','definition','derivation','correlation','identity','unknown')),
  ADD COLUMN IF NOT EXISTS formula_description TEXT,
  ADD COLUMN IF NOT EXISTS formula_context     TEXT,
  ADD COLUMN IF NOT EXISTS formula_variables   JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS formula_units       JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS concept_ids         UUID[] NOT NULL DEFAULT '{}';

-- Phase 3: job locking (columns may already exist from CREATE TABLE above; safe)
ALTER TABLE ingestion_jobs
  ADD COLUMN IF NOT EXISTS locked_by        TEXT,
  ADD COLUMN IF NOT EXISTS locked_until     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS current_step     TEXT,
  ADD COLUMN IF NOT EXISTS payload          JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS result           JSONB,
  ADD COLUMN IF NOT EXISTS last_error       TEXT,
  ADD COLUMN IF NOT EXISTS max_attempts     INT NOT NULL DEFAULT 3;

-- sections: add document_version_id if missing (for fast version-based queries)
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS document_version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE;

-- ── 4. New tables ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_tables (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id            UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  table_markdown      TEXT NOT NULL,
  table_text          TEXT NOT NULL,
  table_caption       TEXT,
  table_context       TEXT,
  source_page         INT,
  ordinal_in_chunk    INT NOT NULL DEFAULT 0,
  fts_vector          TSVECTOR,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query                TEXT NOT NULL,
  query_parsed         JSONB NOT NULL DEFAULT '{}',
  user_id              TEXT,
  subject_id           UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  course_id            UUID REFERENCES courses(id)  ON DELETE SET NULL,
  tenant_id            TEXT,
  candidate_count      INT,
  final_count          INT,
  top_chunk_ids        UUID[],
  latency_ms           INT,
  embedding_latency_ms INT,
  fts_count            INT,
  vector_count         INT,
  concept_count        INT,
  formula_count        INT,
  zero_results         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retrieval_log_id   UUID REFERENCES retrieval_logs(id) ON DELETE SET NULL,
  query              TEXT NOT NULL,
  answer_text        TEXT NOT NULL,
  answer_model       TEXT,
  cited_chunk_ids    UUID[],
  prompt_token_count INT,
  answer_token_count INT,
  guardrail_flags    JSONB NOT NULL DEFAULT '[]',
  latency_ms         INT,
  user_id            TEXT,
  subject_id         UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  tenant_id          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS query_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_log_id       UUID REFERENCES answer_logs(id) ON DELETE SET NULL,
  retrieval_log_id    UUID REFERENCES retrieval_logs(id) ON DELETE SET NULL,
  user_id             TEXT,
  query               TEXT,
  feedback_type       TEXT NOT NULL
                      CHECK (feedback_type IN (
                        'thumbs_up','thumbs_down','wrong_chapter','missing_formula',
                        'too_long','too_short','hallucinated','irrelevant','useful','other'
                      )),
  feedback_text       TEXT,
  retrieved_chunk_ids UUID[],
  subject_id          UUID REFERENCES cadeiras(id) ON DELETE SET NULL,
  tenant_id           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chunks_fts              ON chunks USING GIN (fts_vector);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding        ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_chunks_dedupe           ON chunks (dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_chunks_version          ON chunks (document_version_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chapter          ON chunks (chapter_id, chunk_no);
CREATE INDEX IF NOT EXISTS idx_chunks_section          ON chunks (section_id);
CREATE INDEX IF NOT EXISTS idx_chunks_prev             ON chunks (previous_chunk_id) WHERE previous_chunk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_next             ON chunks (next_chunk_id)     WHERE next_chunk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_subject          ON chunks (subject_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tenant           ON chunks (tenant_id);

CREATE INDEX IF NOT EXISTS idx_formulas_hash           ON formulas (formula_hash);
CREATE INDEX IF NOT EXISTS idx_formulas_normalized_trgm ON formulas USING GIN (normalized_latex gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_formulas_kind           ON formulas (formula_kind);

CREATE INDEX IF NOT EXISTS idx_aliases_norm            ON concept_aliases (alias_norm);
CREATE INDEX IF NOT EXISTS idx_aliases_norm_trgm       ON concept_aliases USING GIN (alias_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mentions_concept_conf   ON concept_mentions (concept_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_chunk          ON concept_mentions (chunk_id);

CREATE INDEX IF NOT EXISTS idx_relations_source        ON concept_relations (source_concept_id, relation_type, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_relations_active        ON concept_relations (source_concept_id, relation_type) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_chapters_version        ON chapters (document_version_id, chapter_no);
CREATE INDEX IF NOT EXISTS idx_sections_chapter        ON sections (chapter_id, ordinal_in_chapter);
CREATE INDEX IF NOT EXISTS idx_sections_version        ON sections (document_version_id) WHERE document_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_versions_doc   ON document_versions (document_id, version_no);
CREATE INDEX IF NOT EXISTS idx_docversions_active      ON document_versions (document_id, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_documents_subject       ON documents (subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant        ON documents (tenant_id);

CREATE INDEX IF NOT EXISTS idx_jobs_queued             ON ingestion_jobs (status, created_at) WHERE status IN ('queued','retrying');
CREATE INDEX IF NOT EXISTS idx_jobs_locked             ON ingestion_jobs (locked_until) WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dtables_chunk           ON document_tables (chunk_id);
CREATE INDEX IF NOT EXISTS idx_dtables_version         ON document_tables (document_version_id);
CREATE INDEX IF NOT EXISTS idx_dtables_fts             ON document_tables USING GIN (fts_vector);

CREATE INDEX IF NOT EXISTS idx_retrieval_logs_subject  ON retrieval_logs (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_zero     ON retrieval_logs (zero_results, created_at DESC) WHERE zero_results = TRUE;
CREATE INDEX IF NOT EXISTS idx_answer_logs_retrieval   ON answer_logs (retrieval_log_id);
CREATE INDEX IF NOT EXISTS idx_answer_logs_subject     ON answer_logs (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_subject        ON query_feedback (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_type           ON query_feedback (feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_answer         ON query_feedback (answer_log_id);

-- ── 6. Triggers ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION chunks_fts_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(array_to_string(NEW.heading_path, ' '), '')), 'A') ||
    setweight(to_tsvector('pg_catalog.portuguese', coalesce(NEW.content_plain, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chunks_fts_trigger ON chunks;
CREATE TRIGGER chunks_fts_trigger
  BEFORE INSERT OR UPDATE OF content_plain, heading_path ON chunks
  FOR EACH ROW EXECUTE FUNCTION chunks_fts_update();

CREATE OR REPLACE FUNCTION document_tables_fts_update()
RETURNS TRIGGER AS $$
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

-- ── 7. RPC search functions ───────────────────────────────────

CREATE OR REPLACE FUNCTION fts_search(
  query_text    text,
  p_course_id   uuid   DEFAULT NULL,
  p_document_id uuid   DEFAULT NULL,
  p_chunk_types text[] DEFAULT NULL,
  p_limit       int    DEFAULT 30
)
RETURNS TABLE (chunk_id uuid, score float4) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    ts_rank_cd(c.fts_vector, websearch_to_tsquery('pg_catalog.portuguese', query_text), 32)::float4
  FROM chunks c
  JOIN document_versions dv ON dv.id = c.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE
    c.fts_vector @@ websearch_to_tsquery('pg_catalog.portuguese', query_text)
    AND dv.status NOT IN ('superseded', 'failed')
    AND (p_course_id IS NULL  OR d.course_id  = p_course_id)
    AND (p_document_id IS NULL OR d.id         = p_document_id)
    AND (p_chunk_types IS NULL OR c.chunk_type = ANY(p_chunk_types))
  ORDER BY 2 DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION vector_search(
  query_vector  vector,
  p_course_id   uuid   DEFAULT NULL,
  p_document_id uuid   DEFAULT NULL,
  p_chunk_types text[] DEFAULT NULL,
  p_limit       int    DEFAULT 30,
  p_ef_search   int    DEFAULT 100
)
RETURNS TABLE (chunk_id uuid, score float4) AS $$
BEGIN
  PERFORM set_config('hnsw.ef_search', p_ef_search::text, true);
  RETURN QUERY
  SELECT
    c.id,
    (1 - (c.embedding <=> query_vector))::float4
  FROM chunks c
  JOIN document_versions dv ON dv.id = c.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE
    c.embedding IS NOT NULL
    AND dv.status NOT IN ('superseded', 'failed')
    AND (p_course_id IS NULL  OR d.course_id  = p_course_id)
    AND (p_document_id IS NULL OR d.id         = p_document_id)
    AND (p_chunk_types IS NULL OR c.chunk_type = ANY(p_chunk_types))
  ORDER BY c.embedding <=> query_vector
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION concept_search(
  query_norm  text,
  p_course_id uuid DEFAULT NULL,
  p_limit     int  DEFAULT 20
)
RETURNS TABLE (chunk_id uuid, score float4) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (cm.chunk_id)
    cm.chunk_id,
    (ca.weight * cm.confidence)::float4
  FROM concept_aliases ca
  JOIN concepts con ON con.id = ca.concept_id
  JOIN concept_mentions cm ON cm.concept_id = con.id
  JOIN chunks c ON c.id = cm.chunk_id
  JOIN document_versions dv ON dv.id = c.document_version_id
  WHERE
    (ca.alias_norm = query_norm OR similarity(ca.alias_norm, query_norm) > 0.4)
    AND con.status = 'active'
    AND dv.status NOT IN ('superseded', 'failed')
    AND (p_course_id IS NULL OR con.course_id = p_course_id)
  ORDER BY cm.chunk_id, 2 DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION formula_fuzzy_search(
  query_latex text,
  p_course_id uuid DEFAULT NULL,
  p_limit     int  DEFAULT 10
)
RETURNS TABLE (chunk_id uuid, similarity float4) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.chunk_id,
    similarity(f.normalized_latex, query_latex)::float4
  FROM formulas f
  JOIN chunks c ON c.id = f.chunk_id
  JOIN document_versions dv ON dv.id = c.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE
    similarity(f.normalized_latex, query_latex) > 0.3
    AND dv.status NOT IN ('superseded', 'failed')
    AND (p_course_id IS NULL OR d.course_id = p_course_id)
  ORDER BY 2 DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 8. Helper functions ───────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_version_for_reprocess(p_version_id UUID, p_step TEXT DEFAULT 'all')
RETURNS void AS $$
BEGIN
  UPDATE document_versions
  SET status = 'processing', reprocess_requested_at = NOW(), is_active = FALSE
  WHERE id = p_version_id;

  INSERT INTO ingestion_jobs (document_version_id, job_type, status, payload)
  VALUES (p_version_id, 'parse', 'queued', jsonb_build_object('reprocess_step', p_step));
END;
$$ LANGUAGE plpgsql;

-- ── 9. RLS (permissive — tighten after auth is wired) ─────────

ALTER TABLE chunks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_feedback    ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_logs       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_chunks"            ON chunks;
DROP POLICY IF EXISTS "service_role_all_documents"         ON documents;
DROP POLICY IF EXISTS "service_role_all_document_versions" ON document_versions;
DROP POLICY IF EXISTS "service_role_all_feedback"          ON query_feedback;
DROP POLICY IF EXISTS "service_role_all_retrieval_logs"    ON retrieval_logs;
DROP POLICY IF EXISTS "service_role_all_answer_logs"       ON answer_logs;

CREATE POLICY "service_role_all_chunks"            ON chunks            FOR ALL USING (true);
CREATE POLICY "service_role_all_documents"         ON documents         FOR ALL USING (true);
CREATE POLICY "service_role_all_document_versions" ON document_versions FOR ALL USING (true);
CREATE POLICY "service_role_all_feedback"          ON query_feedback    FOR ALL USING (true);
CREATE POLICY "service_role_all_retrieval_logs"    ON retrieval_logs    FOR ALL USING (true);
CREATE POLICY "service_role_all_answer_logs"       ON answer_logs       FOR ALL USING (true);

-- ── 10. Rebuild FTS on existing rows (safe no-op if empty) ────

UPDATE chunks
SET fts_vector = (
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(array_to_string(heading_path, ' '), '')), 'A') ||
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(content_plain, '')), 'C')
)
WHERE fts_vector IS NULL;
