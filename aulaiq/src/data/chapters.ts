import type { QuizQuestion } from '../types/progress';

export interface Chapter {
  id: string;
  name: string;
}

const SUBJECT_CHAPTERS: Record<string, Chapter[]> = {
  // ── Gestão ─────────────────────────────────────────────────────────
  'g-y1-s1-micro': [
    { id: 'procura-oferta', name: 'Procura e Oferta' },
    { id: 'elasticidades', name: 'Elasticidades' },
    { id: 'teoria-consumidor', name: 'Teoria do Consumidor' },
    { id: 'teoria-produtor', name: 'Teoria do Produtor' },
    { id: 'estruturas-mercado', name: 'Estruturas de Mercado' },
    { id: 'externalidades', name: 'Externalidades' },
  ],
  'g-y1-s1-mat1': [
    { id: 'funcoes', name: 'Funções' },
    { id: 'limites', name: 'Limites' },
    { id: 'derivadas', name: 'Derivadas' },
    { id: 'otimizacao', name: 'Otimização' },
    { id: 'integrais', name: 'Integrais' },
    { id: 'aplicacoes-eco', name: 'Aplicações Económicas' },
  ],
  'g-y1-s2-contfin': [
    { id: 'balanco', name: 'Balanço' },
    { id: 'dem-resultados', name: 'Demonstração de Resultados' },
    { id: 'lancamentos', name: 'Lançamentos Contabilísticos' },
    { id: 'ativos-passivos', name: 'Ativos e Passivos' },
    { id: 'acrescimos', name: 'Acréscimos e Diferimentos' },
    { id: 'fecho-contas', name: 'Fecho de Contas' },
  ],
  'g-y1-s2-macro': [
    { id: 'pib', name: 'PIB e Contas Nacionais' },
    { id: 'inflacao', name: 'Inflação' },
    { id: 'desemprego', name: 'Desemprego' },
    { id: 'pol-monetaria', name: 'Política Monetária' },
    { id: 'pol-orcamental', name: 'Política Orçamental' },
    { id: 'crescimento', name: 'Crescimento Económico' },
  ],
  // ── Economia ────────────────────────────────────────────────────────
  'eco-y1-s1-micro': [
    { id: 'procura-oferta', name: 'Procura e Oferta' },
    { id: 'elasticidades', name: 'Elasticidades' },
    { id: 'teoria-consumidor', name: 'Teoria do Consumidor' },
    { id: 'teoria-produtor', name: 'Teoria do Produtor' },
    { id: 'estruturas-mercado', name: 'Estruturas de Mercado' },
    { id: 'externalidades', name: 'Externalidades' },
  ],
  'eco-y1-s1-mat1': [
    { id: 'funcoes', name: 'Funções' },
    { id: 'limites', name: 'Limites' },
    { id: 'derivadas', name: 'Derivadas' },
    { id: 'otimizacao', name: 'Otimização' },
    { id: 'integrais', name: 'Integrais' },
    { id: 'aplicacoes-eco', name: 'Aplicações Económicas' },
  ],
  'eco-y1-s2-contfin': [
    { id: 'balanco', name: 'Balanço' },
    { id: 'dem-resultados', name: 'Demonstração de Resultados' },
    { id: 'lancamentos', name: 'Lançamentos Contabilísticos' },
    { id: 'ativos-passivos', name: 'Ativos e Passivos' },
    { id: 'acrescimos', name: 'Acréscimos e Diferimentos' },
    { id: 'fecho-contas', name: 'Fecho de Contas' },
  ],
  'eco-y1-s2-macro': [
    { id: 'pib', name: 'PIB e Contas Nacionais' },
    { id: 'inflacao', name: 'Inflação' },
    { id: 'desemprego', name: 'Desemprego' },
    { id: 'pol-monetaria', name: 'Política Monetária' },
    { id: 'pol-orcamental', name: 'Política Orçamental' },
    { id: 'crescimento', name: 'Crescimento Económico' },
  ],
  // ── Enfermagem ──────────────────────────────────────────────────────
  'enf-y1-s1-anat1': [
    { id: 'cardiovascular', name: 'Sistema Cardiovascular' },
    { id: 'respiratorio', name: 'Sistema Respiratório' },
    { id: 'nervoso', name: 'Sistema Nervoso' },
    { id: 'muscular', name: 'Sistema Muscular' },
    { id: 'digestivo', name: 'Sistema Digestivo' },
  ],
  'enf-y2-s3-farmaco': [
    { id: 'farmacocinetica', name: 'Farmacocinética' },
    { id: 'farmacodinamica', name: 'Farmacodinâmica' },
    { id: 'administracao', name: 'Administração de Medicamentos' },
    { id: 'seguranca', name: 'Segurança Terapêutica' },
    { id: 'reacoes', name: 'Reações Adversas' },
  ],
};

const FALLBACK_CHAPTERS: Chapter[] = [
  { id: 'conceitos', name: 'Conceitos Fundamentais' },
  { id: 'exercicios', name: 'Exercícios Base' },
  { id: 'aplicacoes', name: 'Aplicações Práticas' },
  { id: 'faq', name: 'Perguntas Frequentes' },
  { id: 'preparacao', name: 'Preparação para Avaliação' },
];

export function getChaptersForSubject(subjectId: string): Chapter[] {
  return SUBJECT_CHAPTERS[subjectId] ?? FALLBACK_CHAPTERS;
}

export function getDemoQuizQuestions(chapterName: string, subjectName: string): QuizQuestion[] {
  return [
    {
      id: `q1`,
      question: `Em "${chapterName}", qual dos seguintes conceitos é considerado central?`,
      options: [
        'A variável independente nunca influencia o resultado',
        'O equilíbrio é sempre o ponto de maior eficiência',
        'O contexto determina o comportamento das variáveis',
        'Todos os modelos são universalmente aplicáveis',
      ],
      correctIndex: 2,
      explanation: `Em ${chapterName} (${subjectName}), o contexto é fundamental — os resultados dependem das condições e pressupostos do modelo. Em produção, estas perguntas serão geradas por IA com base nos materiais reais da cadeira.`,
    },
    {
      id: `q2`,
      question: `Qual é a principal diferença entre análise estática e dinâmica em "${chapterName}"?`,
      options: [
        'Não existe diferença relevante',
        'A análise estática ignora o tempo; a dinâmica considera a evolução',
        'A análise dinâmica é sempre preferível',
        'A análise estática é mais recente',
      ],
      correctIndex: 1,
      explanation: `A distinção clássica em ${chapterName}: análise estática compara estados de equilíbrio, análise dinâmica estuda como o sistema evolui ao longo do tempo.`,
    },
    {
      id: `q3`,
      question: `Num exame de "${subjectName}", "${chapterName}" costuma ser avaliado através de:`,
      options: [
        'Apenas definições teóricas',
        'Apenas cálculo numérico',
        'Casos práticos, teoria e cálculo',
        'Escolha múltipla exclusivamente',
      ],
      correctIndex: 2,
      explanation: `Os professores avaliam ${chapterName} de formas variadas — domínio teórico, aplicação a casos práticos e resolução numérica são todos frequentes.`,
    },
    {
      id: `q4`,
      question: `Quando se diz que um sistema em "${chapterName}" está em equilíbrio, isso significa:`,
      options: [
        'Que não existem forças a actuar',
        'Que as forças opostas se anulam e o estado é estável',
        'Que o sistema parou de funcionar',
        'Que atingiu o máximo possível',
      ],
      correctIndex: 1,
      explanation: `Equilíbrio em ${chapterName} não significa ausência de forças — significa que as forças se compensam, resultando num estado estável que persiste sem perturbações externas.`,
    },
    {
      id: `q5`,
      question: `Qual a principal limitação dos modelos usados em "${chapterName}"?`,
      options: [
        'São demasiado complexos para serem úteis',
        'Simplificam a realidade e podem não capturar todos os factores',
        'Funcionam apenas em contextos académicos',
        'Não têm qualquer aplicação prática',
      ],
      correctIndex: 1,
      explanation: `Todos os modelos em ${subjectName} implicam simplificações — a sua força está em isolar variáveis-chave, mas a sua limitação é exactamente essa: ignoram alguma complexidade do mundo real.`,
    },
  ];
}
