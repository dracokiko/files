-- ============================================================
-- AulaIQ — Knowledge Graph v2 Schema
-- Run in Supabase: Dashboard → SQL Editor → New Query → Run
-- Requires: pgvector, pg_trgm, unaccent extensions
-- Vector dimension default: 768 (Gemini text-embedding-004)
-- Set EMBEDDING_DIM=1024 and use Voyage for 1024-dim vectors
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── courses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  lang_code   TEXT NOT NULL DEFAULT 'pt-PT',
  cadeira_id  UUID REFERENCES cadeiras(id) ON DELETE SET NULL,  -- link to existing structure
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── documents ────────────────────────────────────────────────
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

-- ── document_versions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id             UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no              INT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'uploaded'
                          CHECK (status IN ('uploaded','processing','processed','failed','superseded')),
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

-- ── chapters ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  chapter_no          INT NOT NULL,
  title               TEXT NOT NULL,
  summary             TEXT,
  page_start          INT,
  page_end            INT
);

-- ── sections ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id         UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  parent_section_id  UUID REFERENCES sections(id) ON DELETE SET NULL,
  section_level      SMALLINT NOT NULL,
  title              TEXT NOT NULL,
  heading_path       TEXT[] NOT NULL DEFAULT '{}',
  ordinal_in_chapter INT NOT NULL,
  page_start         INT,
  page_end           INT
);

-- ── chunks ───────────────────────────────────────────────────
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
  embedding           vector(768),   -- 768 for Gemini; set to 1024 if using Voyage
  token_count         INT NOT NULL,
  char_count          INT NOT NULL,
  page_start          INT,
  page_end            INT,
  dedupe_hash         TEXT NOT NULL,
  source_spans        JSONB NOT NULL DEFAULT '[]',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── formulas ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS formulas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id              UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
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

-- ── concepts ─────────────────────────────────────────────────
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

-- ── concept_aliases ──────────────────────────────────────────
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

-- ── concept_mentions ─────────────────────────────────────────
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

-- ── concept_relations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concept_relations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relation_type     TEXT NOT NULL
                    CHECK (relation_type IN ('same_as','broader_than','narrower_than','prerequisite_of','used_with','derived_from','defined_by','contrasts_with','appears_with')),
  evidence_chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  confidence        NUMERIC(5,4) NOT NULL,
  extractor         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ingestion_jobs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  job_type            TEXT NOT NULL
                      CHECK (job_type IN ('parse','chunk','embed','extract_concepts','validate','reindex')),
  status              TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','running','succeeded','failed','needs_review')),
  attempt_no          INT NOT NULL DEFAULT 1,
  metrics             JSONB NOT NULL DEFAULT '{}',
  error_payload       JSONB,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── validation_issues ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS validation_issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  severity         TEXT NOT NULL CHECK (severity IN ('info','warning','error')),
  issue_code       TEXT NOT NULL,
  message          TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chunks_fts
  ON chunks USING GIN (fts_vector);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_formulas_hash
  ON formulas (formula_hash);

CREATE INDEX IF NOT EXISTS idx_formulas_normalized_trgm
  ON formulas USING GIN (normalized_latex gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_aliases_norm
  ON concept_aliases (alias_norm);

CREATE INDEX IF NOT EXISTS idx_aliases_norm_trgm
  ON concept_aliases USING GIN (alias_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mentions_concept_conf
  ON concept_mentions (concept_id, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_mentions_chunk
  ON concept_mentions (chunk_id);

CREATE INDEX IF NOT EXISTS idx_relations_source
  ON concept_relations (source_concept_id, relation_type, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_chapters_version
  ON chapters (document_version_id, chapter_no);

CREATE INDEX IF NOT EXISTS idx_sections_chapter
  ON sections (chapter_id, ordinal_in_chapter);

CREATE INDEX IF NOT EXISTS idx_chunks_chapter
  ON chunks (chapter_id, chunk_no);

CREATE INDEX IF NOT EXISTS idx_chunks_section
  ON chunks (section_id);

CREATE INDEX IF NOT EXISTS idx_chunks_dedupe
  ON chunks (dedupe_hash);

CREATE INDEX IF NOT EXISTS idx_chunks_version
  ON chunks (document_version_id);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc
  ON document_versions (document_id, version_no);

-- ── FTS trigger ──────────────────────────────────────────────
-- Weighted: heading_path (A) scores higher than body (C)
CREATE OR REPLACE FUNCTION chunks_fts_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_vector :=
    setweight(
      to_tsvector('pg_catalog.portuguese',
        coalesce(array_to_string(NEW.heading_path, ' '), '')), 'A') ||
    setweight(
      to_tsvector('pg_catalog.portuguese',
        coalesce(NEW.content_plain, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chunks_fts_trigger ON chunks;
CREATE TRIGGER chunks_fts_trigger
  BEFORE INSERT OR UPDATE OF content_plain, heading_path ON chunks
  FOR EACH ROW EXECUTE FUNCTION chunks_fts_update();

-- ── pgvector tuning ──────────────────────────────────────────
-- Allow iterative scan for filtered ANN queries
-- Run per-session or in your connection config:
-- SET hnsw.ef_search = 100;
-- SET enable_indexscan = on;
