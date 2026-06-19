/**
 * Validation gates for ingestion pipeline.
 * Returns { passed: bool, issues: [{severity, issue_code, message, payload}] }
 */

export function validateChapters(chapters) {
  const issues = []

  let lastNo = 0
  for (const ch of chapters) {
    if (ch.chapter_no <= lastNo) {
      issues.push({
        severity: 'error',
        issue_code: 'CHAPTER_ORDER_NON_MONOTONIC',
        message: `Chapter ${ch.chapter_no} follows chapter ${lastNo} — numbering must be monotonically increasing`,
        payload: { chapter_no: ch.chapter_no, previous: lastNo },
      })
    }
    lastNo = ch.chapter_no
  }

  return { passed: issues.every(i => i.severity !== 'error'), issues }
}

export function validateSections(sections) {
  const issues = []
  const byChapter = {}

  for (const s of sections) {
    const key = s.chapter_id
    if (!byChapter[key]) byChapter[key] = []
    byChapter[key].push(s)
  }

  for (const [chapterId, secs] of Object.entries(byChapter)) {
    let lastOrdinal = 0
    for (const s of secs.sort((a, b) => a.ordinal_in_chapter - b.ordinal_in_chapter)) {
      if (s.ordinal_in_chapter <= lastOrdinal) {
        issues.push({
          severity: 'warning',
          issue_code: 'SECTION_ORDINAL_NON_MONOTONIC',
          message: `Section "${s.title}" has ordinal ${s.ordinal_in_chapter} after ${lastOrdinal}`,
          payload: { chapter_id: chapterId, section_title: s.title },
        })
      }
      lastOrdinal = s.ordinal_in_chapter
    }
  }

  return { passed: true, issues }   // section order is warning-only
}

export function validateChunks(chunks, chapterIds, sectionIds) {
  const issues = []
  const chapterSet = new Set(chapterIds)
  const sectionSet = new Set(sectionIds)

  for (const chunk of chunks) {
    if (!chapterSet.has(chunk.chapter_id)) {
      issues.push({
        severity: 'error',
        issue_code: 'CHUNK_ORPHAN_CHAPTER',
        message: `Chunk ${chunk.chunk_no} references unknown chapter_id ${chunk.chapter_id}`,
        payload: { chunk_no: chunk.chunk_no },
      })
    }
    if (!sectionSet.has(chunk.section_id)) {
      issues.push({
        severity: 'error',
        issue_code: 'CHUNK_ORPHAN_SECTION',
        message: `Chunk ${chunk.chunk_no} references unknown section_id ${chunk.section_id}`,
        payload: { chunk_no: chunk.chunk_no },
      })
    }
    if (chunk.token_count > parseInt(process.env.CHUNK_MAX_TOKENS ?? '900') * 1.2) {
      issues.push({
        severity: 'warning',
        issue_code: 'CHUNK_OVERSIZED',
        message: `Chunk ${chunk.chunk_no} has ${chunk.token_count} tokens (limit ~900)`,
        payload: { chunk_no: chunk.chunk_no, token_count: chunk.token_count },
      })
    }
  }

  return { passed: issues.every(i => i.severity !== 'error'), issues }
}

export function validateFormulas(formulas) {
  const issues = []

  for (const f of formulas) {
    if (f.extraction_confidence < 0 || f.extraction_confidence > 1) {
      issues.push({
        severity: 'error',
        issue_code: 'FORMULA_CONFIDENCE_OUT_OF_RANGE',
        message: `Formula ordinal ${f.ordinal_in_chunk} has confidence ${f.extraction_confidence}`,
        payload: { ordinal: f.ordinal_in_chunk },
      })
    }
    if (!f.original_latex?.trim()) {
      issues.push({
        severity: 'error',
        issue_code: 'FORMULA_EMPTY_LATEX',
        message: `Formula ordinal ${f.ordinal_in_chunk} has empty original_latex`,
        payload: { ordinal: f.ordinal_in_chunk },
      })
    }
    if (f.extraction_confidence < 0.70) {
      issues.push({
        severity: 'warning',
        issue_code: 'FORMULA_LOW_CONFIDENCE',
        message: `Formula "${f.original_latex?.slice(0, 40)}" has low confidence ${f.extraction_confidence}`,
        payload: { ordinal: f.ordinal_in_chunk, confidence: f.extraction_confidence },
      })
    }
  }

  return { passed: issues.every(i => i.severity !== 'error'), issues }
}

export function validateEmbedding(vector, expectedDim) {
  if (!vector) return { passed: true, issues: [] }   // null = embeddings disabled
  if (!Array.isArray(vector) || vector.length !== expectedDim) {
    return {
      passed: false,
      issues: [{
        severity: 'error',
        issue_code: 'EMBEDDING_DIM_MISMATCH',
        message: `Expected ${expectedDim}-dim embedding, got ${vector?.length ?? 'null'}`,
        payload: { expected: expectedDim, got: vector?.length },
      }],
    }
  }
  return { passed: true, issues: [] }
}

export function validateMentionConfidences(mentions) {
  const issues = []
  for (const m of mentions) {
    if (m.confidence < 0 || m.confidence > 1) {
      issues.push({
        severity: 'error',
        issue_code: 'MENTION_CONFIDENCE_OUT_OF_RANGE',
        message: `Mention confidence ${m.confidence} is out of [0,1]`,
        payload: { mention: m },
      })
    }
  }
  return { passed: issues.every(i => i.severity !== 'error'), issues }
}

export function validateRelationConfidences(relations) {
  const issues = []
  for (const r of relations) {
    if (r.confidence < 0 || r.confidence > 1) {
      issues.push({
        severity: 'error',
        issue_code: 'RELATION_CONFIDENCE_OUT_OF_RANGE',
        message: `Relation confidence ${r.confidence} is out of [0,1]`,
        payload: { relation: r },
      })
    }
  }
  return { passed: issues.every(i => i.severity !== 'error'), issues }
}

/** Merge multiple validation results into one. */
export function mergeValidation(...results) {
  return {
    passed: results.every(r => r.passed),
    issues: results.flatMap(r => r.issues),
  }
}
