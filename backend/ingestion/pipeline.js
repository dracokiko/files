/**
 * Full ingestion pipeline.
 *
 * Flow:
 *   upload → sha256 dedup → parse → chunk → store structure →
 *   extract formulas → embed chunks → extract concepts → validate → done
 */

import { createHash } from 'crypto'
import { parseDocument } from './parsers/index.js'
import { chunkDocument, extractStructure } from './chunker.js'
import { extractFormulas, hashLaTeX } from './formula.js'
import { embedDocuments, getProviderInfo } from './embeddings.js'
import {
  extractConceptsPassA,
  extractConceptsPassB,
  normalizeAlias,
  mentionStatus,
  relationStatus,
  ConceptExtractionError,
} from './concepts.js'
import {
  validateChapters,
  validateSections,
  validateChunks,
  validateFormulas,
  validateEmbedding,
  validateMentionConfidences,
  validateRelationConfidences,
  mergeValidation,
} from './validator.js'

const PIPELINE_VERSION = '1.0.0'

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Ingest a document into the knowledge graph.
 *
 * @param {object} opts
 * @param {Buffer}  opts.buffer         - Raw file bytes
 * @param {string}  opts.sourceKind     - 'pdf'|'docx'|'latex'|'markdown'|'html'|'txt'
 * @param {string}  opts.filename       - Original filename (for metadata)
 * @param {string}  opts.courseId       - UUID of the course
 * @param {string}  opts.documentTitle  - Human-readable title
 * @param {string}  opts.langCode       - Language code (default 'pt-PT')
 * @param {object}  opts.supabaseAdmin  - Supabase admin client
 * @param {object}  opts.genai          - Google GenerativeAI instance
 * @param {object}  opts.options        - Optional overrides
 */
export async function ingestDocument({
  buffer, sourceKind, filename, courseId, documentTitle,
  langCode = 'pt-PT', supabaseAdmin, genai, options = {},
}) {
  const sha256 = hashBuffer(buffer)

  // ── Deduplication ─────────────────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('document_versions')
    .select('id, status, document_id')
    .eq('source_sha256', sha256)
    .limit(1)
    .single()

  if (existing) {
    return {
      action: 'already_exists',
      document_version_id: existing.id,
      document_id: existing.document_id,
      status: existing.status,
    }
  }

  // ── Create / find document ─────────────────────────────────────────────────
  let documentId = options.documentId
  if (!documentId) {
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .insert({
        course_id: courseId,
        source_kind: sourceKind,
        title: documentTitle ?? filename,
        original_filename: filename,
        lang_code: langCode,
      })
      .select('id')
      .single()
    if (docErr) throw new Error(`Failed to create document: ${docErr.message}`)
    documentId = doc.id
  }

  // ── Get next version number ────────────────────────────────────────────────
  const { count } = await supabaseAdmin
    .from('document_versions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
  const versionNo = (count ?? 0) + 1

  // ── Create document_version ────────────────────────────────────────────────
  const { data: docVersion, error: dvErr } = await supabaseAdmin
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_no: versionNo,
      status: 'processing',
      source_sha256: sha256,
      source_metadata: { filename },
    })
    .select('id')
    .single()
  if (dvErr) throw new Error(`Failed to create document_version: ${dvErr.message}`)
  const versionId = docVersion.id

  // ── Create ingestion job ───────────────────────────────────────────────────
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('ingestion_jobs')
    .insert({ document_version_id: versionId, job_type: 'parse', status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single()
  if (jobErr) throw new Error(`Failed to create ingestion_job: ${jobErr.message}`)
  const jobId = job.id

  const allIssues = []

  try {
    // ── Step 1: Parse ────────────────────────────────────────────────────────
    const parsed = await parseDocument(buffer, sourceKind)
    await supabaseAdmin.from('document_versions').update({
      parser_name: parsed.parser_name,
      parser_version: parsed.parser_version,
      page_count: parsed.page_count,
      ocr_used: parsed.ocr_used,
      formula_extraction_used: parsed.formula_extraction_used,
      source_metadata: { filename, ...parsed.metadata },
      parse_artifact: { markdown_length: parsed.markdown.length },
    }).eq('id', versionId)

    // ── Step 2: Chunk ────────────────────────────────────────────────────────
    const rawChunks = chunkDocument(parsed.markdown, { pageMap: parsed.pageMap })
    const structureBlocks = parsed.markdown.split('\n').filter(l => l.match(/^#{1,4}\s/))
    const structureChapters = extractStructure(
      structureBlocks.map(l => {
        const m = l.match(/^(#{1,4})\s+(.+)/)
        return m ? { type: 'heading', level: m[1].length, heading: m[2].trim(), page: null } : null
      }).filter(Boolean)
    )

    // Validate chapter ordering
    const chapValidation = validateChapters(structureChapters)
    allIssues.push(...chapValidation.issues)

    // ── Step 3: Store chapters ────────────────────────────────────────────────
    const chapterRows = []
    for (const ch of structureChapters) {
      const { data: chRow, error: chErr } = await supabaseAdmin.from('chapters').insert({
        document_version_id: versionId,
        chapter_no: ch.chapter_no,
        title: ch.title,
        page_start: ch.page_start,
        page_end: ch.page_end,
      }).select('id').single()
      if (chErr) throw new Error(`Chapter insert error: ${chErr.message}`)
      chapterRows.push({ ...ch, id: chRow.id })
    }

    // Synthetic fallback chapter if none detected
    let defaultChapterId
    if (!chapterRows.length) {
      const { data: ch } = await supabaseAdmin.from('chapters').insert({
        document_version_id: versionId, chapter_no: 1, title: 'Documento',
      }).select('id').single()
      defaultChapterId = ch.id
    }

    // ── Step 4: Store sections ────────────────────────────────────────────────
    const sectionRows = []
    for (const ch of chapterRows) {
      for (const sec of ch.sections ?? []) {
        const { data: secRow } = await supabaseAdmin.from('sections').insert({
          chapter_id: ch.id,
          section_level: sec.section_level,
          title: sec.title,
          heading_path: sec.heading_path,
          ordinal_in_chapter: sec.ordinal_in_chapter,
          page_start: sec.page_start,
          page_end: sec.page_end,
        }).select('id').single()
        sectionRows.push({ ...sec, id: secRow.id, chapter_id: ch.id })
      }
    }

    // Synthetic fallback section
    let defaultSectionId
    if (!sectionRows.length) {
      const { data: sec } = await supabaseAdmin.from('sections').insert({
        chapter_id: defaultChapterId ?? chapterRows[0]?.id,
        section_level: 1,
        title: 'Conteúdo',
        heading_path: ['Conteúdo'],
        ordinal_in_chapter: 1,
      }).select('id').single()
      defaultSectionId = sec.id
    }

    const resolveChapter = (headingPath) => {
      if (!headingPath?.length) return defaultChapterId ?? chapterRows[0]?.id
      const match = chapterRows.find(c => headingPath[0]?.includes(c.title) || c.title?.includes(headingPath[0]))
      return match?.id ?? defaultChapterId ?? chapterRows[0]?.id
    }

    const resolveSection = (headingPath, chapterId) => {
      if (!headingPath?.length || !chapterId) return defaultSectionId ?? sectionRows[0]?.id
      const match = sectionRows.find(s => s.chapter_id === chapterId && headingPath.includes(s.title))
      return match?.id ?? sectionRows.find(s => s.chapter_id === chapterId)?.id ?? defaultSectionId ?? sectionRows[0]?.id
    }

    // ── Step 5: Store chunks ──────────────────────────────────────────────────
    const storedChunks = []
    let totalTokens = 0

    for (const rawChunk of rawChunks) {
      const chapterId = resolveChapter(rawChunk.heading_path)
      const sectionId = resolveSection(rawChunk.heading_path, chapterId)

      // Dedup check
      const { data: existing } = await supabaseAdmin.from('chunks')
        .select('id').eq('dedupe_hash', rawChunk.dedupe_hash)
        .eq('document_version_id', versionId).limit(1).single()
      if (existing) { storedChunks.push({ ...rawChunk, id: existing.id }); continue }

      const { data: chunkRow, error: chunkErr } = await supabaseAdmin.from('chunks').insert({
        document_version_id: versionId,
        chapter_id: chapterId,
        section_id: sectionId,
        chunk_no: rawChunk.chunk_no,
        chunk_type: rawChunk.chunk_type,
        heading_path: rawChunk.heading_path,
        content_markdown: rawChunk.content_markdown,
        content_plain: rawChunk.content_plain,
        content_norm: rawChunk.content_norm,
        token_count: rawChunk.token_count,
        char_count: rawChunk.char_count,
        page_start: rawChunk.page_start,
        page_end: rawChunk.page_end,
        dedupe_hash: rawChunk.dedupe_hash,
        source_spans: rawChunk.source_spans,
        metadata: rawChunk.metadata,
      }).select('id').single()
      if (chunkErr) throw new Error(`Chunk insert error: ${chunkErr.message}`)

      totalTokens += rawChunk.token_count
      storedChunks.push({ ...rawChunk, id: chunkRow.id, chapter_id: chapterId, section_id: sectionId })
    }

    await supabaseAdmin.from('document_versions').update({ token_count: totalTokens }).eq('id', versionId)

    // ── Step 6: Extract and store formulas ────────────────────────────────────
    const allFormulas = []
    for (const chunk of storedChunks) {
      const formulas = extractFormulas(chunk.content_markdown)
      if (!formulas.length) continue

      const fValidation = validateFormulas(formulas)
      allIssues.push(...fValidation.issues.map(i => ({ ...i, payload: { ...i.payload, chunk_id: chunk.id } })))

      for (const f of formulas) {
        const { data: fRow } = await supabaseAdmin.from('formulas').insert({
          chunk_id: chunk.id,
          ordinal_in_chunk: f.ordinal_in_chunk,
          original_latex: f.original_latex,
          normalized_latex: f.normalized_latex,
          formula_hash: f.formula_hash,
          is_display: f.is_display,
          symbols: f.symbols,
          extraction_confidence: f.extraction_confidence,
          mathml: null,
          page_no: chunk.page_start,
        }).select('id').single()
        if (fRow) allFormulas.push({ ...f, id: fRow.id, chunk_id: chunk.id })
      }
    }

    // ── Step 7: Embed chunks ──────────────────────────────────────────────────
    await supabaseAdmin.from('ingestion_jobs').update({
      job_type: 'embed', status: 'running',
    }).eq('id', jobId)

    const { dimensions } = getProviderInfo()
    const texts = storedChunks.map(c =>
      (c.heading_path?.join(' > ') ?? '') + '\n' + c.content_plain
    )

    let vectors = []
    try {
      vectors = await embedDocuments(texts)
    } catch (embedErr) {
      allIssues.push({
        severity: 'warning',
        issue_code: 'EMBED_FAILED',
        message: `Embedding failed: ${embedErr.message}`,
        payload: { provider: getProviderInfo() },
      })
      vectors = texts.map(() => null)
    }

    for (let i = 0; i < storedChunks.length; i++) {
      const v = vectors[i]
      const { passed, issues } = validateEmbedding(v, dimensions)
      allIssues.push(...issues.map(is => ({ ...is, payload: { chunk_no: i } })))
      if (v && passed) {
        await supabaseAdmin.from('chunks').update({ embedding: v }).eq('id', storedChunks[i].id)
      }
    }

    // ── Step 8: Concept extraction ────────────────────────────────────────────
    await supabaseAdmin.from('ingestion_jobs').update({
      job_type: 'extract_concepts', status: 'running',
    }).eq('id', jobId)

    // Pass A
    const passAConcepts = extractConceptsPassA(storedChunks)
    // Pass B (only for chunks with meaningful content)
    const passBConcepts = []
    let courseTitle = ''
    if (courseId) {
      const { data: course } = await supabaseAdmin.from('courses').select('title').eq('id', courseId).single()
      courseTitle = course?.title ?? ''
    }

    const CONCEPT_CHUNK_TYPES = new Set(['definition','theorem','proof','example','summary','body'])
    for (const chunk of storedChunks) {
      if (!CONCEPT_CHUNK_TYPES.has(chunk.chunk_type)) continue
      if (chunk.token_count < 50) continue
      try {
        const result = await extractConceptsPassB(chunk, genai, { course_title: courseTitle, lang_code: langCode })
        for (const c of result.concepts ?? []) {
          passBConcepts.push({ ...c, chunk_id: chunk.id })
        }
      } catch (err) {
        allIssues.push({
          severity: 'warning',
          issue_code: 'CONCEPT_EXTRACTION_FAILED',
          message: err.message,
          payload: { chunk_id: chunk.id },
        })
      }
    }

    // Merge and store concepts
    await _storeConcepts({
      passAConcepts,
      passBConcepts,
      courseId,
      storedChunks,
      allFormulas,
      jobId,
      supabaseAdmin,
    })

    // ── Step 9: Validation ────────────────────────────────────────────────────
    await supabaseAdmin.from('ingestion_jobs').update({
      job_type: 'validate', status: 'running',
    }).eq('id', jobId)

    if (allIssues.length) {
      const issueRows = allIssues.map(i => ({
        ingestion_job_id: jobId,
        severity: i.severity,
        issue_code: i.issue_code,
        message: i.message,
        payload: i.payload ?? {},
      }))
      await supabaseAdmin.from('validation_issues').insert(issueRows)
    }

    const hasErrors = allIssues.some(i => i.severity === 'error')
    const finalStatus = hasErrors ? 'needs_review' : 'succeeded'

    // ── Step 10: Mark as processed ────────────────────────────────────────────
    await Promise.all([
      supabaseAdmin.from('document_versions').update({ status: hasErrors ? 'failed' : 'processed' }).eq('id', versionId),
      supabaseAdmin.from('ingestion_jobs').update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        metrics: {
          chunks: storedChunks.length,
          formulas: allFormulas.length,
          issues: allIssues.length,
          tokens: totalTokens,
        },
      }).eq('id', jobId),
    ])

    return {
      action: 'ingested',
      document_id: documentId,
      document_version_id: versionId,
      job_id: jobId,
      status: finalStatus,
      metrics: {
        chunks: storedChunks.length,
        formulas: allFormulas.length,
        issues: allIssues.length,
        tokens: totalTokens,
      },
    }

  } catch (err) {
    await Promise.all([
      supabaseAdmin.from('document_versions').update({ status: 'failed' }).eq('id', versionId),
      supabaseAdmin.from('ingestion_jobs').update({
        status: 'failed',
        error_payload: { message: err.message, stack: err.stack?.slice(0, 500) },
        finished_at: new Date().toISOString(),
      }).eq('id', jobId),
    ])
    throw err
  }
}

// ── Concept storage helper ────────────────────────────────────────────────────

async function _storeConcepts({ passAConcepts, passBConcepts, courseId, storedChunks, allFormulas, jobId, supabaseAdmin }) {
  const conceptMap = new Map()   // canonical_name_lower → concept_id

  const allConcepts = [
    ...passAConcepts.map(c => ({ ...c, extractor: 'pass_a_deterministic' })),
    ...passBConcepts.map(c => ({ ...c, extractor: 'pass_b_gemini' })),
  ]

  for (const concept of allConcepts) {
    if (!concept.canonical_name?.trim()) continue
    const key = concept.canonical_name.toLowerCase().trim()

    let conceptId = conceptMap.get(key)

    if (!conceptId) {
      const { data: existing } = await supabaseAdmin.from('concepts')
        .select('id, status').eq('course_id', courseId)
        .ilike('canonical_name', concept.canonical_name).limit(1).single()

      if (existing) {
        conceptId = existing.id
      } else {
        const { data: inserted } = await supabaseAdmin.from('concepts').insert({
          course_id: courseId,
          canonical_name: concept.canonical_name,
          concept_type: concept.concept_type ?? 'concept',
          definition: concept.definition,
          lang_code: concept.lang_code ?? 'pt-PT',
          confidence: concept.confidence ?? 1.0,
          status: (concept.confidence ?? 1.0) < 0.60 ? 'needs_review' : 'active',
        }).select('id').single()
        conceptId = inserted?.id
      }

      if (!conceptId) continue
      conceptMap.set(key, conceptId)

      // Store canonical alias
      await supabaseAdmin.from('concept_aliases').upsert({
        concept_id: conceptId,
        alias_text: concept.canonical_name,
        alias_norm: normalizeAlias(concept.canonical_name),
        alias_kind: 'canonical',
        weight: 1.0,
        is_curated: concept.extractor === 'pass_a_deterministic',
      }, { onConflict: 'concept_id,alias_norm' })

      // Store additional aliases
      for (const alias of concept.aliases ?? []) {
        const aliasNorm = normalizeAlias(alias.alias_text)
        // Don't overwrite curated aliases with inferred ones
        const { data: existingAlias } = await supabaseAdmin.from('concept_aliases')
          .select('is_curated').eq('concept_id', conceptId).eq('alias_norm', aliasNorm).single()

        if (existingAlias?.is_curated && !concept.is_curated) continue

        await supabaseAdmin.from('concept_aliases').upsert({
          concept_id: conceptId,
          alias_text: alias.alias_text,
          alias_norm: aliasNorm,
          alias_kind: alias.alias_kind ?? 'llm_inferred',
          weight: alias.weight ?? 0.40,
          is_curated: false,
        }, { onConflict: 'concept_id,alias_norm' })
      }
    }

    // Store mentions
    for (const mention of concept.mentions ?? []) {
      const status = mentionStatus(mention.confidence)
      if (status === 'rejected') continue

      const chunk = storedChunks.find(c => c.id === concept.chunk_id)
      if (!chunk) continue

      await supabaseAdmin.from('concept_mentions').insert({
        concept_id: conceptId,
        chunk_id: chunk.id,
        mention_kind: mention.mention_kind ?? 'body',
        evidence_text: mention.evidence_text?.slice(0, 500),
        confidence: mention.confidence,
        extractor: concept.extractor,
      })
    }

    // Store relations
    for (const rel of concept.relations ?? []) {
      const status = relationStatus(rel.confidence)
      if (status === 'rejected') continue
      const targetKey = rel.target_concept?.toLowerCase()?.trim()
      if (!targetKey) continue
      const targetId = conceptMap.get(targetKey)
      if (!targetId || targetId === conceptId) continue

      await supabaseAdmin.from('concept_relations').insert({
        source_concept_id: conceptId,
        target_concept_id: targetId,
        relation_type: rel.relation_type,
        evidence_chunk_id: concept.chunk_id,
        confidence: rel.confidence,
        extractor: concept.extractor,
      })
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}
