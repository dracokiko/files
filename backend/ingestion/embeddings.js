/**
 * Pluggable embedding provider abstraction.
 *
 * Providers:
 *   - gemini   (default, 768 dims, uses existing GEMINI_API_KEY)
 *   - voyage   (1024 dims, requires VOYAGE_API_KEY)
 *   - none     (disables embeddings — FTS-only mode)
 *
 * Config via env:
 *   EMBEDDING_PROVIDER=gemini|voyage|none
 *   EMBEDDING_MODEL=text-embedding-004        (for gemini)
 *               =voyage-4                     (for voyage)
 *   EMBEDDING_DIM=768                         (must match model output)
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const PROVIDER = (process.env.EMBEDDING_PROVIDER ?? 'gemini').toLowerCase()
const MODEL    = process.env.EMBEDDING_MODEL ?? (PROVIDER === 'voyage' ? 'voyage-4' : 'text-embedding-004')
export const DIM = parseInt(process.env.EMBEDDING_DIM ?? (PROVIDER === 'voyage' ? '1024' : '768'))

export function getProviderInfo() {
  return { provider: PROVIDER, model: MODEL, dimensions: DIM }
}

// ── Gemini provider ───────────────────────────────────────────────────────────

async function geminiEmbed(texts) {
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genai.getGenerativeModel({ model: MODEL })

  const vectors = []
  // Gemini embedding API processes one text at a time
  for (const text of texts) {
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
    })
    const values = result.embedding.values
    if (values.length !== DIM) {
      throw new Error(`Embedding dimension mismatch: expected ${DIM}, got ${values.length}`)
    }
    vectors.push(values)
  }
  return vectors
}

async function geminiEmbedQuery(text) {
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genai.getGenerativeModel({ model: MODEL })
  const result = await model.embedContent({
    content: { parts: [{ text }] },
    taskType: 'RETRIEVAL_QUERY',
  })
  return result.embedding.values
}

// ── Voyage provider ───────────────────────────────────────────────────────────

async function voyageEmbed(texts) {
  if (!process.env.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY not set')

  const BATCH = 128
  const vectors = []

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH)
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, input: batch, input_type: 'document' }),
    })
    if (!res.ok) throw new Error(`Voyage API error: ${res.status} ${await res.text()}`)
    const json = await res.json()
    for (const item of json.data) {
      if (item.embedding.length !== DIM) {
        throw new Error(`Voyage embedding dim mismatch: expected ${DIM}, got ${item.embedding.length}`)
      }
      vectors.push(item.embedding)
    }
  }
  return vectors
}

async function voyageEmbedQuery(text) {
  if (!process.env.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY not set')
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input: [text], input_type: 'query' }),
  })
  if (!res.ok) throw new Error(`Voyage API error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.data[0].embedding
}

// ── Public interface ──────────────────────────────────────────────────────────

/**
 * Embed an array of document texts.
 * Returns an array of float arrays (one per input text).
 */
export async function embedDocuments(texts) {
  if (PROVIDER === 'none' || !texts.length) return texts.map(() => null)
  if (PROVIDER === 'voyage') return voyageEmbed(texts)
  return geminiEmbed(texts)
}

/**
 * Embed a single query string for retrieval.
 * Returns a float array.
 */
export async function embedQuery(text) {
  if (PROVIDER === 'none') return null
  if (PROVIDER === 'voyage') return voyageEmbedQuery(text)
  return geminiEmbedQuery(text)
}
