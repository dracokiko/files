/**
 * Example script: ingest a single document into the knowledge graph.
 *
 * Usage:
 *   node backend/scripts/ingest_one.js --file notes.pdf --course <courseId>
 *   node backend/scripts/ingest_one.js --file lecture.md --course <courseId> --title "Lecture 1"
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ingestDocument } from '../ingestion/pipeline.js'
import { mimeToKind } from '../ingestion/parsers/index.js'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    file:    { type: 'string' },
    course:  { type: 'string' },
    title:   { type: 'string' },
    lang:    { type: 'string', default: 'pt-PT' },
    sync:    { type: 'boolean', default: true },
  },
})

if (!values.file || !values.course) {
  console.error('Usage: node ingest_one.js --file <path> --course <courseId>')
  process.exit(1)
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const buffer = readFileSync(values.file)
const filename = values.file.split('/').pop()
const sourceKind = mimeToKind(null, filename)

if (!sourceKind) {
  console.error(`Unsupported file type: ${filename}`)
  process.exit(1)
}

console.log(`Ingesting: ${filename} (${sourceKind}) into course ${values.course}`)

try {
  const result = await ingestDocument({
    buffer,
    sourceKind,
    filename,
    courseId: values.course,
    documentTitle: values.title ?? filename,
    langCode: values.lang,
    supabaseAdmin,
    genai,
  })

  console.log('\nResult:', JSON.stringify(result, null, 2))
} catch (err) {
  console.error('Ingestion failed:', err.message)
  process.exit(1)
}
