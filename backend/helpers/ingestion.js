import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// knowledge_base/ lives at the project root (two levels up from backend/helpers/)
const KB_DIR = join(__dirname, '../../knowledge_base')

function buildIngestionPrompt(texto, contexto) {
  return `És um assistente especializado em processar material educativo universitário português.

CONTEXTO:
- Cadeira: ${contexto.cadeira}
- Curso: ${contexto.curso}
- Faculdade: ${contexto.faculdade}
${contexto.modulo ? `- Módulo/Capítulo: ${contexto.modulo}` : ''}
${contexto.ano_letivo ? `- Ano letivo: ${contexto.ano_letivo}` : ''}

Analisa o material educativo abaixo e devolve um JSON com esta estrutura exata. Responde APENAS com JSON válido, sem texto extra.

{
  "resumo": "resumo claro e didático do material em 3-5 parágrafos",
  "conceitos_chave": ["conceito 1", "conceito 2"],
  "definicoes": [{"termo": "...", "definicao": "..."}],
  "formulas": [{"nome": "...", "formula": "...", "explicacao": "..."}],
  "exemplos_resolvidos": [{"titulo": "...", "enunciado": "...", "resolucao": "..."}],
  "perguntas_exame": [{"pergunta": "...", "resposta_esperada": "...", "dificuldade": "facil|medio|dificil"}],
  "duvidas_frequentes": [{"duvida": "...", "resposta": "..."}],
  "glossario": [{"termo": "...", "definicao": "..."}],
  "qa_estruturado": [{"pergunta": "...", "resposta": "..."}],
  "metadata": {
    "qualidade": "alta|media|baixa",
    "avisos": [],
    "topicos_principais": [],
    "completude": "completo|parcial|incompleto",
    "tipo_material": "slides|resumo|exercicios|livro|apontamentos|outro"
  }
}

MATERIAL:
${texto.slice(0, 80000)}`
}

// Calls Gemini to process raw educational text into structured knowledge JSON.
// Saves to disk locally (skipped on Vercel since FS is ephemeral).
export async function processarMaterial({ texto, contexto, materialId, genai }) {
  const model = genai.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  })

  const result = await model.generateContent(buildIngestionPrompt(texto, contexto))
  const rawText = result.response.text()

  let processado
  try {
    processado = JSON.parse(rawText)
  } catch {
    // Gemini sometimes wraps JSON in markdown code fences — strip them
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) processado = JSON.parse(match[1].trim())
    else throw new Error('A IA não devolveu JSON válido. Tenta novamente.')
  }

  // Persist to disk when running locally for easy inspection
  if (!process.env.VERCEL && materialId) {
    const dir = join(KB_DIR, materialId)
    await mkdir(dir, { recursive: true })
    await Promise.all([
      writeFile(join(dir, 'processed.json'), JSON.stringify(processado, null, 2)),
      writeFile(join(dir, 'raw.txt'), texto),
    ])
  }

  return processado
}

// Converts a processed knowledge JSON into a flat text block for Gemini's system prompt.
// The chatbot's quality depends on this being well-structured.
export function buildKnowledgeContext(processado, nomeCadeira) {
  if (!processado) return ''
  const parts = [`=== MATERIAL PROCESSADO: ${nomeCadeira} ===`]

  if (processado.resumo)
    parts.push(`\nRESUMO:\n${processado.resumo}`)

  if (processado.conceitos_chave?.length)
    parts.push(`\nCONCEITOS CHAVE:\n${processado.conceitos_chave.join(' | ')}`)

  if (processado.definicoes?.length)
    parts.push(`\nDEFINIÇÕES:\n${processado.definicoes.map(d => `• ${d.termo}: ${d.definicao}`).join('\n')}`)

  if (processado.formulas?.length)
    parts.push(`\nFÓRMULAS:\n${processado.formulas.map(f => `• ${f.nome}: ${f.formula} — ${f.explicacao}`).join('\n')}`)

  if (processado.exemplos_resolvidos?.length)
    parts.push(`\nEXEMPLOS RESOLVIDOS:\n${processado.exemplos_resolvidos.map(e => `• ${e.titulo}\n  ${e.enunciado}\n  Resolução: ${e.resolucao}`).join('\n')}`)

  if (processado.qa_estruturado?.length)
    parts.push(`\nQ&A:\n${processado.qa_estruturado.map(q => `P: ${q.pergunta}\nR: ${q.resposta}`).join('\n\n')}`)

  if (processado.perguntas_exame?.length)
    parts.push(`\nPERGUNTAS DE EXAME:\n${processado.perguntas_exame.map(p => `• [${p.dificuldade}] ${p.pergunta} → ${p.resposta_esperada}`).join('\n')}`)

  if (processado.glossario?.length)
    parts.push(`\nGLOSSÁRIO:\n${processado.glossario.map(g => `• ${g.termo}: ${g.definicao}`).join('\n')}`)

  if (processado.duvidas_frequentes?.length)
    parts.push(`\nDÚVIDAS FREQUENTES:\n${processado.duvidas_frequentes.map(d => `• ${d.duvida}\n  → ${d.resposta}`).join('\n')}`)

  parts.push('\n=== FIM DO MATERIAL ===')
  return parts.join('\n')
}
