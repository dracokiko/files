# AulaIQ — Knowledge Graph v2

Production-grade academic content ingestion, hybrid retrieval, and AI-answer system.

---

## Architecture

### Ingestion

```
Upload (PDF/DOCX/LaTeX/MD)
        │
        ▼
    [Parser]  → markdown + pageMap
        │
        ▼
    [Chunker] → structure-aware chunks (700 tokens target, parent-child linked)
        │
        ├──▶ [Formula Extractor] → formulas table (LaTeX preserved, kind+variables metadata)
        ├──▶ [Table Extractor]   → document_tables (caption, FTS)
        ├──▶ [Embedder]          → chunks.embedding (vector(768), Gemini)
        └──▶ [Concept Extractor]
                Pass A (deterministic regex) + Pass B (Gemini strict JSON)
                → concepts, aliases, mentions, relations, merge_suggestions
```

### Retrieval + Answer Generation

```
Query string
     │
     ▼
[Query Parser] → intent, weights, quoted phrases, formula exprs, chapter refs, preferredChunkTypes
     │
     ├──▶ FTS (websearch_to_tsquery, Portuguese)          ─┐
     ├──▶ ANN (pgvector HNSW cosine, ef_search tunable)   │
     ├──▶ Concept alias lookup → concept_mentions → chunks │── [Score Fusion]
     └──▶ Formula exact hash + pg_trgm fuzzy               │   (weighted linear)
                                                           ─┘
                                                            │
                                                            ▼
                                                      [Heuristic Reranker]
                                                      +chunk_type×intent boost
                                                      +heading match
                                                      +formula match
                                                      −superseded penalty
                                                      −short chunk penalty
                                                            │
                                                            ▼
                                                     [Prompt Builder]
                                                     intent-driven instruction
                                                     + context blocks [1]..[n]
                                                            │
                                                            ▼
                                                      [Gemini 1.5-flash]
                                                       T=0.1 (low hallucination)
                                                            │
                                                            ▼
                                                      [Guardrails]
                                                      citation range check
                                                      hallucination keyword scan
                                                      invented formula detection
                                                            │
                                                            ▼
                                               Answer + Citations + Bibliography
```

---

## Database Schema

### Core (knowledge_v2_schema.sql)

| Table | Purpose |
|-------|---------|
| `courses` | One row per subject/cadeira |
| `documents` | One row per uploaded file |
| `document_versions` | Immutable versioned snapshots (SHA-256 dedup) |
| `chapters` | H1-level headings per version |
| `sections` | H2..H4 sections within chapters |
| `chunks` | 700-token structure-aware chunks with FTS + embedding |
| `formulas` | LaTeX formulas extracted from chunks, with hash |
| `concepts` | Canonical academic concepts per course |
| `concept_aliases` | Name variants, abbreviations, symbols |
| `concept_mentions` | Links concept → chunk with confidence |
| `concept_relations` | Typed edges between concepts |
| `ingestion_jobs` | Audit trail of pipeline runs |
| `validation_issues` | Per-job quality flags |

### Extended (knowledge_v2_migration.sql — run after schema)

| Table | Purpose |
|-------|---------|
| `document_tables` | HTML/Markdown tables as first-class objects with FTS |
| `concept_merge_suggestions` | AI-proposed concept deduplication pairs |
| `retrieval_logs` | Every search query logged with latency + result count |
| `answer_logs` | Every generated answer logged with guardrail flags |
| `query_feedback` | User thumbs up/down + typed feedback |

Key column additions:
- `documents`: `subject_id`, `tenant_id`, `visibility`, `plan_access_level`
- `chunks`: `previous_chunk_id`, `next_chunk_id`, `source_span_start/end`, `subject_id`, `tenant_id`
- `document_versions`: `is_active`, `content_hash`, `chunker_version`, `embedding_model`
- `ingestion_jobs`: `locked_by`, `locked_until`, `progress_percent`, `current_step`, `payload`, `last_error`
- `formulas`: `formula_kind`, `formula_description`, `formula_variables`, `concept_ids`
- `concept_relations`: `direction`, `created_by`, `is_active` + 8 new relation types

---

## Ingestion Flow

1. `POST /admin/api/v2/ingest/sync` with `{ base64, filename, mimeType, courseId }`
2. Document and `document_version` created in DB (SHA-256 dedup)
3. Parser selected by file type (PDF, DOCX, LaTeX, Markdown)
4. Chunker splits into ~700-token structure-aware chunks (prev/next linked)
5. Formulas extracted, normalized, hashed, kind classified
6. Tables extracted as `document_tables` with their own FTS
7. Chunks stored with FTS trigger updating `fts_vector` (Portuguese stemmer)
8. Embeddings computed (Gemini text-embedding-004, 768 dims)
9. Concepts extracted (Pass A deterministic regex + Pass B Gemini JSON)
10. Validation issues recorded; `document_version.status` → `processed`/`needs_review`/`failed`

The request awaits the full pipeline before responding — there is no
background job queue. An `ingestion_jobs` row is created and updated as the
pipeline progresses (for the audit trail / `GET /jobs/:id`), but nothing
processes jobs asynchronously; ingestion always runs inline within the
request that submitted it.

---

## Retrieval + Answer Flow

1. `POST /api/v2/search` with `{ query, course_id?, top_k? }` — retrieval only
2. `POST /api/v2/answer` with `{ query, course_id?, top_k? }` — retrieval + AI answer

**Retrieval pipeline:**
1. Query parsed: `intent`, `weights`, formula exprs, chapter refs, preferredChunkTypes
2. 4 sources queried in parallel: FTS, vector ANN, concept alias, formula hash
3. Scores normalized per-source, fused with intent-adjusted weights
4. Heuristic reranker: chunk_type×intent boost, heading match, formula match, version penalty
5. Top-K returned with full provenance

**Answer pipeline (additional steps):**
6. `buildPrompt`: intent-specific instruction + context blocks with [n] markers
7. Gemini 1.5-flash generates answer (temperature=0.1)
8. Guardrails check: citation range, hallucination keywords, invented formula detection
9. Bibliography appended; answer logged to `answer_logs`

**Feedback:**
- `POST /api/v2/feedback` — submit thumbs up/down or detailed feedback type

**Evaluation:**
- `node backend/evals/retrieval_eval.js --fixtures ...` — Recall@K, Precision@K, MRR, nDCG@K

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_PROVIDER` | `gemini` | `gemini`, `voyage`, or `none` |
| `EMBEDDING_MODEL` | `text-embedding-004` | Model ID for embeddings |
| `EMBEDDING_DIM` | `768` | Vector dimensions (must match model) |
| `VOYAGE_API_KEY` | — | Required if EMBEDDING_PROVIDER=voyage |
| `ANSWER_MODEL` | `gemini-1.5-flash` | Gemini model for answer generation |
| `CHUNK_TARGET_TOKENS` | `700` | Target chunk size |
| `CHUNK_MIN_TOKENS` | `350` | Minimum chunk size |
| `CHUNK_MAX_TOKENS` | `900` | Hard cap on chunk size |
| `CHUNK_OVERLAP_TOKENS` | `120` | Overlap between consecutive chunks |
| `RETRIEVAL_TOP_K` | `10` | Default number of results |
| `HNSW_EF_SEARCH` | `100` | pgvector HNSW ef_search parameter |

---

## SQL Setup (Supabase)

Run in order in Supabase SQL Editor:

```
1. backend/db/knowledge_v2_schema.sql     — tables + indexes + FTS trigger + RLS
2. backend/db/knowledge_v2_rpc.sql        — search RPC functions
3. backend/db/knowledge_v2_migration.sql  — Phase 1–12 additions (safe, ADD COLUMN IF NOT EXISTS)
```

---

## API Endpoints

### Ingestion (admin, /admin/api/v2)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ingest/sync` | Ingest a document (awaits full pipeline before responding) |
| `GET`  | `/jobs/:id` | Poll job status + progress_percent |
| `GET`  | `/jobs/:id/issues` | Validation issues for a job |
| `GET`  | `/documents` | List documents |
| `GET`  | `/documents/:id/versions` | List versions |
| `GET`  | `/courses` | List courses |
| `POST` | `/courses` | Create a course |
| `GET`  | `/answer/logs` | Recent answer logs |
| `GET`  | `/feedback` | Recent feedback entries |
| `GET`  | `/feedback/stats` | Aggregate feedback stats |

### Retrieval + Answer (public, /api/v2)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/search` | Hybrid search (retrieval only) |
| `GET`  | `/search?q=` | Hybrid search (GET form) |
| `POST` | `/answer` | Retrieval + AI answer + citations |
| `GET`  | `/formula/:hash` | Exact formula lookup |
| `GET`  | `/concept?alias=` | Concept + mentions by alias |
| `GET`  | `/parse-query?q=` | Debug query analysis (shows intent) |
| `POST` | `/feedback` | Submit user feedback |

---

## Commands

```bash
# Run all unit tests (135 tests, 0 failures)
node backend/tests/formula.test.js      # 14 tests
node backend/tests/chunker.test.js      # 15 tests
node backend/tests/query_parser.test.js # 9 tests
node backend/tests/validator.test.js    # 14 tests
node backend/tests/citations.test.js    # 10 tests
node backend/tests/guardrails.test.js   # 13 tests
node backend/tests/query_intent.test.js # 19 tests
node backend/tests/reranker.test.js     # 9 tests
node backend/tests/eval_metrics.test.js # 19 tests
node backend/tests/team.test.js         # 13 tests

# Ingest a document (example)
node backend/scripts/ingest_one.js --file notes.pdf --course <courseId>

# Retrieval only
curl -X POST http://localhost:3000/api/v2/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"derivada de função composta","course_id":"<uuid>","top_k":5}'

# Retrieval + AI answer + citations
curl -X POST http://localhost:3000/api/v2/answer \
  -H 'Content-Type: application/json' \
  -d '{"query":"o que é transformação linear?","course_id":"<uuid>"}'

# Run retrieval eval
node backend/evals/retrieval_eval.js --fixtures backend/evals/fixtures/expected_cases.json --topk 10

# Submit feedback
curl -X POST http://localhost:3000/api/v2/feedback \
  -H 'Content-Type: application/json' \
  -d '{"feedback_type":"thumbs_up","query":"...","answer_log_id":"<uuid>"}'

# Debug query parsing (shows intent, weights, preferredChunkTypes)
curl 'http://localhost:3000/api/v2/parse-query?q=o+que+%C3%A9+derivada'
```

---

## Embedding Providers

### Gemini (default, out-of-the-box)
- Model: `text-embedding-004`
- Dimensions: 768
- Requires: `GEMINI_API_KEY` (already set)
- Schema column: `vector(768)`

### Voyage AI (recommended for production)
- Model: `voyage-4`
- Dimensions: 1024
- Requires: `VOYAGE_API_KEY`
- Schema column: must be changed to `vector(1024)` before first ingest
- Set: `EMBEDDING_PROVIDER=voyage EMBEDDING_DIM=1024`

---

## Tuning Notes

**Chunking:** Adjust `CHUNK_TARGET_TOKENS` based on your content density. Dense technical text (LaTeX-heavy) benefits from smaller chunks (500-600). Prose-heavy content can use larger (700-800).

**HNSW:** Increase `HNSW_EF_SEARCH` for better recall at the cost of latency. Start at 100, increase to 200 for high-recall use cases.

**Retrieval weights:** Increase `formula` weight for STEM courses. Increase `concept` weight for definition-heavy courses. The `parse-query` endpoint shows which weights will be applied to a given query.

**Concept confidence:** Concepts from Pass B with confidence < 0.60 are created with `status=needs_review` and can be reviewed in the admin panel.

---

## Known Limitations

1. **PPTX** not supported — convert to PDF or Markdown first.
2. **Image-only PDFs** (scanned without OCR layer) will produce poor text extraction. MathPix or AWS Textract integration needed for OCR formulas.
3. **MathML** conversion not implemented — `mathml` column is always `null`.
4. **HNSW iterative scan** for filtered ANN queries requires pgvector ≥ 0.7.0 (Supabase has this).
5. **Embedding dimension change** after first ingest requires dropping and recreating the embedding column and HNSW index.
6. **Concept Pass B** calls Gemini once per eligible chunk — for large documents this may be slow and use significant API quota.
