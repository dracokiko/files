/**
 * Two-pass concept extraction.
 *
 * Pass A: deterministic high-precision extraction from structural patterns.
 * Pass B: Gemini-based extraction with strict JSON schema and confidence scores.
 */

// ── Pass A: Deterministic extraction ─────────────────────────────────────────

const DEFINITION_PATTERNS = [
  /^\*{1,2}(Definição|Definition|Def\.?)(?:\s+[\d.]+)?\*{0,2}\s*[:\-–]?\s*(.+)/im,
  /^\*{1,2}(Teorema|Theorem|Thm\.?)(?:\s+[\d.]+)?\*{0,2}\s*[:\-–]?\s*(.+)/im,
  /^\*{1,2}(Lema|Lemma)(?:\s+[\d.]+)?\*{0,2}\s*[:\-–]?\s*(.+)/im,
  /^\*{1,2}(Corolário|Corollary)(?:\s+[\d.]+)?\*{0,2}\s*[:\-–]?\s*(.+)/im,
  /^\*{1,2}(Lei|Law|Princípio|Principle)(?:\s+[\d.]+)?\*{0,2}\s*[:\-–]?\s*(.+)/im,
  /^\*{1,2}(Método|Method|Algoritmo|Algorithm)(?:\s+[\d.]+)?\*{0,2}\s*[:\-–]?\s*(.+)/im,
  /^\*{1,2}(Propriedade|Property)(?:\s+[\d.]+)?\*{0,2}\s*[:\-–]?\s*(.+)/im,
]

const HEADING_TO_TYPE = {
  'definição': 'definition', 'definition': 'definition', 'def': 'definition',
  'teorema': 'theorem', 'theorem': 'theorem', 'thm': 'theorem',
  'lema': 'theorem', 'lemma': 'theorem',
  'corolário': 'theorem', 'corollary': 'theorem',
  'lei': 'law', 'law': 'law', 'princípio': 'law', 'principle': 'law',
  'método': 'method', 'method': 'method', 'algoritmo': 'method', 'algorithm': 'method',
  'propriedade': 'concept', 'property': 'concept',
  'conceito': 'concept', 'concept': 'concept',
}

/**
 * Pass A: extract concepts from structural patterns without calling an LLM.
 * Returns array of { canonical_name, concept_type, definition, source, confidence }
 */
export function extractConceptsPassA(chunks) {
  const results = []

  for (const chunk of chunks) {
    const text = chunk.content_markdown

    // 1. Heading-based: H1/H2/H3 named as known concept types
    const headingMatch = text.match(/^#{1,4}\s+(.+)/m)
    if (headingMatch) {
      const heading = headingMatch[1].trim()
      const headingLower = heading.toLowerCase()
      const typeFromHeading = Object.entries(HEADING_TO_TYPE)
        .find(([k]) => headingLower.startsWith(k))
      if (typeFromHeading) {
        results.push({
          canonical_name: heading.replace(/^\S+\s+/, ''),  // strip type prefix
          concept_type: typeFromHeading[1],
          definition: null,
          chunk_id: chunk.id,
          source: 'heading',
          confidence: 1.0,
        })
        continue
      }
    }

    // 2. Pattern-based: "**Definição X:** ..."
    for (const pattern of DEFINITION_PATTERNS) {
      const m = text.match(pattern)
      if (m) {
        const typeWord = m[1].toLowerCase().replace('.', '')
        const body = m[2]?.trim()
        const name = extractNameFromDefinitionBody(body)
        if (name) {
          results.push({
            canonical_name: name,
            concept_type: HEADING_TO_TYPE[typeWord] ?? 'concept',
            definition: body,
            chunk_id: chunk.id,
            source: 'definition_pattern',
            confidence: 0.92,
          })
        }
        break
      }
    }

    // 3. "X is defined as Y" / "X designa Y" patterns
    const namedDef = text.match(/\*{1,2}([^*\n]{3,50})\*{1,2}\s+(?:é|is|designa|denota|denotes?|refers? to)\s+(.{20,200})/i)
    if (namedDef) {
      results.push({
        canonical_name: namedDef[1].trim(),
        concept_type: 'concept',
        definition: namedDef[2].trim(),
        chunk_id: chunk.id,
        source: 'inline_definition',
        confidence: 0.78,
      })
    }
  }

  return results
}

function extractNameFromDefinitionBody(text) {
  if (!text) return null
  // "The concept of X" or "O conceito de X" or just a bolded term
  const m = text.match(/(?:^|(?:o|a|the)\s+(?:conceito|definição|concept|notion)\s+de\s+)\*{0,2}([A-ZÁÉÍÓÚ][^.,:*\n]{2,60})\*{0,2}/i)
  if (m) return m[1].trim()
  // First bolded phrase
  const bold = text.match(/\*\*([^*]{3,60})\*\*/)
  if (bold) return bold[1].trim()
  return null
}

// ── Pass B: Gemini extraction ─────────────────────────────────────────────────

const CONCEPT_SCHEMA_DESCRIPTION = `
Extract academic concepts from this chunk of educational content.
Return ONLY valid JSON matching this exact schema — no prose, no markdown fences.

Schema:
{
  "concepts": [
    {
      "canonical_name": "string — the primary name of the concept",
      "concept_type": "concept|law|theorem|definition|method|formula_family|variable|operator|unit|exercise_type",
      "definition": "string or null — a concise definition if present in the text",
      "aliases": [
        {
          "alias_text": "string",
          "alias_kind": "exact_synonym|abbreviation|symbol|formula_signature|lexical_variant|llm_inferred",
          "weight": 0.0
        }
      ],
      "mentions": [
        {
          "mention_kind": "heading|definition_sentence|body|formula|table|caption|exercise",
          "evidence_text": "string — verbatim snippet from the chunk (max 200 chars)",
          "confidence": 0.0
        }
      ],
      "relations": [
        {
          "target_concept": "string",
          "relation_type": "same_as|broader_than|narrower_than|prerequisite_of|used_with|derived_from|defined_by|contrasts_with|appears_with",
          "confidence": 0.0
        }
      ],
      "confidence": 0.0
    }
  ]
}

Rules:
- Only extract concepts that have clear evidence in the text.
- confidence must be between 0 and 1.
- Do not invent concepts not present in the text.
- alias weight: canonical=1.00, exact_synonym=0.90, abbreviation=0.70, symbol=0.50, llm_inferred=0.40.
- If uncertain about a concept, set confidence below 0.60.
- Respond with {"concepts":[]} if no clear concepts are present.
`

/**
 * Pass B: call Gemini with strict JSON schema to extract concepts from a chunk.
 * Returns parsed JSON or throws ValidationError.
 */
export async function extractConceptsPassB(chunk, genai, options = {}) {
  const { course_title = '', lang_code = 'pt-PT' } = options
  const model = genai.getGenerativeModel({
    model: 'gemini-flash-lite-latest',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const prompt = `<task>concept_extraction</task>
<course>${course_title}</course>
<lang>${lang_code}</lang>
<heading_path>${chunk.heading_path?.join(' > ') ?? ''}</heading_path>
<chunk_type>${chunk.chunk_type}</chunk_type>
<content>
${chunk.content_markdown.slice(0, 6000)}
</content>

${CONCEPT_SCHEMA_DESCRIPTION}`

  let attempt = 0
  while (attempt < 2) {
    attempt++
    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const parsed = safeParseJSON(text)
      validateConceptPayload(parsed)
      return parsed
    } catch (err) {
      if (attempt >= 2) throw new ConceptExtractionError(err.message, { chunk_id: chunk.id })
    }
  }
}

function safeParseJSON(text) {
  try { return JSON.parse(text) } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (m) return JSON.parse(m[1].trim())
    throw new Error('Model did not return valid JSON')
  }
}

function validateConceptPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload is not an object')
  if (!Array.isArray(payload.concepts)) throw new Error('payload.concepts is not an array')
  for (const c of payload.concepts) {
    if (typeof c.canonical_name !== 'string' || !c.canonical_name.trim())
      throw new Error('concept missing canonical_name')
    if (typeof c.confidence !== 'number' || c.confidence < 0 || c.confidence > 1)
      throw new Error(`invalid confidence ${c.confidence} for concept "${c.canonical_name}"`)
    for (const m of (c.mentions ?? [])) {
      if (typeof m.confidence !== 'number' || m.confidence < 0 || m.confidence > 1)
        throw new Error('mention confidence out of range')
    }
  }
}

// ── Alias normalization ───────────────────────────────────────────────────────

export function normalizeAlias(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Confidence thresholds ─────────────────────────────────────────────────────

export const MENTION_THRESHOLDS = { accept: 0.85, review: 0.60 }
export const RELATION_THRESHOLDS = { accept: 0.80, review: 0.55 }

export function mentionStatus(confidence) {
  if (confidence >= MENTION_THRESHOLDS.accept) return 'accepted'
  if (confidence >= MENTION_THRESHOLDS.review) return 'needs_review'
  return 'rejected'
}

export function relationStatus(confidence) {
  if (confidence >= RELATION_THRESHOLDS.accept) return 'accepted'
  if (confidence >= RELATION_THRESHOLDS.review) return 'needs_review'
  return 'rejected'
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class ConceptExtractionError extends Error {
  constructor(message, context = {}) {
    super(message)
    this.name = 'ConceptExtractionError'
    this.context = context
  }
}
