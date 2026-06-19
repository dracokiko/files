-- ============================================================
-- AulaIQ — Hybrid search RPC functions
-- Run AFTER knowledge_v2_schema.sql
-- ============================================================

-- ── FTS search ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fts_search(
  query_text    text,
  p_course_id   uuid    DEFAULT NULL,
  p_document_id uuid    DEFAULT NULL,
  p_chunk_types text[]  DEFAULT NULL,
  p_limit       int     DEFAULT 30
)
RETURNS TABLE (chunk_id uuid, score float4) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    ts_rank_cd(c.fts_vector, websearch_to_tsquery('pg_catalog.portuguese', query_text), 32)::float4 AS score
  FROM chunks c
  JOIN document_versions dv ON dv.id = c.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE
    c.fts_vector @@ websearch_to_tsquery('pg_catalog.portuguese', query_text)
    AND dv.status NOT IN ('superseded', 'failed')
    AND (p_course_id IS NULL  OR d.course_id   = p_course_id)
    AND (p_document_id IS NULL OR d.id          = p_document_id)
    AND (p_chunk_types IS NULL OR c.chunk_type  = ANY(p_chunk_types))
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── Vector (ANN) search ───────────────────────────────────────
CREATE OR REPLACE FUNCTION vector_search(
  query_vector  vector,
  p_course_id   uuid    DEFAULT NULL,
  p_document_id uuid    DEFAULT NULL,
  p_chunk_types text[]  DEFAULT NULL,
  p_limit       int     DEFAULT 30,
  p_ef_search   int     DEFAULT 100
)
RETURNS TABLE (chunk_id uuid, score float4) AS $$
BEGIN
  -- Enable iterative HNSW scan for filtered queries
  PERFORM set_config('hnsw.ef_search', p_ef_search::text, true);

  RETURN QUERY
  SELECT
    c.id,
    (1 - (c.embedding <=> query_vector))::float4 AS score
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

-- ── Concept alias search ──────────────────────────────────────
CREATE OR REPLACE FUNCTION concept_search(
  query_norm  text,
  p_course_id uuid  DEFAULT NULL,
  p_limit     int   DEFAULT 20
)
RETURNS TABLE (chunk_id uuid, score float4) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (cm.chunk_id)
    cm.chunk_id,
    (ca.weight * cm.confidence)::float4 AS score
  FROM concept_aliases ca
  JOIN concepts con ON con.id = ca.concept_id
  JOIN concept_mentions cm ON cm.concept_id = con.id
  JOIN chunks c ON c.id = cm.chunk_id
  JOIN document_versions dv ON dv.id = c.document_version_id
  WHERE
    (
      ca.alias_norm = query_norm
      OR similarity(ca.alias_norm, query_norm) > 0.4
    )
    AND con.status = 'active'
    AND dv.status NOT IN ('superseded', 'failed')
    AND (p_course_id IS NULL OR con.course_id = p_course_id)
  ORDER BY cm.chunk_id, score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── Formula fuzzy search ──────────────────────────────────────
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
    similarity(f.normalized_latex, query_latex)::float4 AS similarity
  FROM formulas f
  JOIN chunks c ON c.id = f.chunk_id
  JOIN document_versions dv ON dv.id = c.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE
    similarity(f.normalized_latex, query_latex) > 0.3
    AND dv.status NOT IN ('superseded', 'failed')
    AND (p_course_id IS NULL OR d.course_id = p_course_id)
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── Rebuild FTS vectors on existing rows ──────────────────────
-- Run this once after initial data load
UPDATE chunks SET fts_vector = (
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(array_to_string(heading_path, ' '), '')), 'A') ||
  setweight(to_tsvector('pg_catalog.portuguese', coalesce(content_plain, '')), 'C')
) WHERE fts_vector IS NULL;
