import { parsePdf }      from './pdf.js'
import { parseDocx }     from './docx.js'
import { parseMarkdown } from './markdown.js'
import { parseLatex }    from './latex.js'

/**
 * Route to the correct parser based on source_kind.
 * Returns { markdown, pageMap, page_count, metadata, parser_name, parser_version, ocr_used, formula_extraction_used }
 */
export async function parseDocument(buffer, sourceKind, options = {}) {
  switch (sourceKind) {
    case 'pdf':
      return parsePdf(buffer)

    case 'docx':
      return parseDocx(buffer)

    case 'latex':
      return parseLatex(buffer.toString('utf-8'))

    case 'markdown':
      return parseMarkdown(buffer.toString('utf-8'), 'markdown')

    case 'html':
      return parseMarkdown(buffer.toString('utf-8'), 'html')

    case 'txt':
      return parseMarkdown(buffer.toString('utf-8'), 'markdown')

    case 'pptx':
      // PPTX requires additional tooling (python-pptx or libreoffice).
      // For now: extract as text via a best-effort approach.
      throw new Error('PPTX parsing not yet supported. Convert to PDF or Markdown first.')

    case 'image':
      throw new Error('Image OCR not yet supported. Provide PDF or Markdown instead.')

    default:
      throw new Error(`Unknown source_kind: ${sourceKind}`)
  }
}

export const SUPPORTED_KINDS = ['pdf', 'docx', 'latex', 'markdown', 'html', 'txt']

export function mimeToKind(mimeType, filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') return 'docx'
  if (ext === 'tex' || ext === 'latex') return 'latex'
  if (mimeType === 'text/markdown' || ext === 'md' || ext === 'markdown') return 'markdown'
  if (mimeType === 'text/html' || ext === 'html' || ext === 'htm') return 'html'
  if (mimeType === 'text/plain' || ext === 'txt') return 'txt'
  return null
}
