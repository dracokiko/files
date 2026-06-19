/**
 * Citation formatting — Phase 15.
 * Converts retrieval provenance into human-readable and structured citations.
 */

/**
 * Build a short inline citation string for a chunk.
 * Example: "(Álgebra Linear, Cap. 2, p. 14)"
 */
export function buildInlineCitation(provenance, index) {
  const parts = []
  if (provenance.document_title) parts.push(provenance.document_title)
  if (provenance.chapter_no != null && provenance.chapter_title) {
    parts.push(`Cap. ${provenance.chapter_no}: ${provenance.chapter_title}`)
  } else if (provenance.chapter_no != null) {
    parts.push(`Cap. ${provenance.chapter_no}`)
  }
  if (provenance.section_title) parts.push(`§ ${provenance.section_title}`)
  if (provenance.page_start != null) {
    parts.push(provenance.page_end != null && provenance.page_end !== provenance.page_start
      ? `pp. ${provenance.page_start}–${provenance.page_end}`
      : `p. ${provenance.page_start}`)
  }
  const label = `[${index}]`
  return parts.length ? `${label} ${parts.join(', ')}` : label
}

/**
 * Build a structured citation object for the answer payload.
 */
export function buildStructuredCitation(result, index) {
  return {
    index,
    chunk_id: result.chunk_id,
    document_title: result.provenance?.document_title ?? null,
    chapter_no: result.provenance?.chapter_no ?? null,
    chapter_title: result.provenance?.chapter_title ?? null,
    section_title: result.provenance?.section_title ?? null,
    page_start: result.provenance?.page_start ?? null,
    page_end: result.provenance?.page_end ?? null,
    heading_path: result.provenance?.heading_path ?? [],
    chunk_type: result.chunk_type,
    score: result.final_score ?? result.score,
    inline_ref: buildInlineCitation(result.provenance ?? {}, index),
  }
}

/**
 * Format all citations as a bibliography block (Markdown).
 */
export function formatBibliography(citations) {
  if (!citations.length) return ''
  const lines = ['', '---', '**Fontes:**', '']
  for (const c of citations) {
    lines.push(`${c.inline_ref}`)
  }
  return lines.join('\n')
}

/**
 * Inject citation markers into answer text at logical boundaries.
 * Only marks paragraphs that likely came from retrieved material.
 */
export function injectCitationMarkers(answerText, citations) {
  // Simple approach: append markers after the first sentence of each major paragraph
  // that references a known concept from citations.
  // Advanced approach (LLM-attributed sentences) can be layered on later.
  return answerText  // passthrough for now; marker injection happens in prompt
}
