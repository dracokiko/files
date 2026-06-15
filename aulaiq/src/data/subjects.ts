// Course plans based on official Católica Porto / CPBS and Escola de Enfermagem do Porto study plans.
// Gestão and Economia have 6 semesters; Enfermagem has 8 semesters / 4 years / 240 ECTS.

import type { Subject } from '../types';

export const validYearsByCourse: Record<string, Array<{ value: number; label: string }>> = {
  gestao: [
    { value: 1, label: '1.º ano' },
    { value: 2, label: '2.º ano' },
    { value: 3, label: '3.º ano' },
  ],
  economia: [
    { value: 1, label: '1.º ano' },
    { value: 2, label: '2.º ano' },
    { value: 3, label: '3.º ano' },
  ],
  enfermagem: [
    { value: 1, label: '1.º ano' },
    { value: 2, label: '2.º ano' },
    { value: 3, label: '3.º ano' },
    { value: 4, label: '4.º ano' },
  ],
};

const GESTAO_OPT_I = [
  'Auditoria',
  'Economia do Ambiente',
  'Geopolítica',
  'Liderança e Motivação',
  'Tomada de Decisão',
  'Análise e Visualização de Dados com Power BI',
  'Criação de Apps Organizacionais',
];

const GESTAO_OPT_II = [
  'Controlo de Gestão',
  'Design Thinking',
  'Economia Social',
  'Fundamentos de Programação em Python',
  'Negociação',
  'Novos Desafios do Marketing',
  'Gestão no Futebol Profissional',
  'Fundamentos da Programação em R',
  'Exploração Avançada de Excel',
];

const ECONOMIA_OPT_I = [
  'Auditoria',
  'Economia do Ambiente',
  'Geopolítica',
  'Liderança e Motivação',
  'Tomada de Decisão',
  'Análise e Visualização de Dados com Power BI',
  'Criação de Apps Organizacionais',
];

const ECONOMIA_OPT_II = [
  'Controlo de Gestão',
  'Design Thinking',
  'Economia Social',
  'Fundamentos de Programação em Python',
  'Negociação',
  'Novos Desafios do Marketing',
  'Gestão no Futebol Profissional',
  'Fundamentos da Programação em R',
  'Exploração Avançada em Excel',
];

const ENFERMAGEM_OPT: string[] = [
  'Marketing Profissional',
  'Terapias Complementares',
  'Saúde e Comportamentos',
  'Políticas de Saúde',
];

export const courseSubjectsByInstitution: Record<string, Record<string, Subject[]>> = {
  catolica: {
    gestao: [
      // ── 1.º ano · 1.º semestre ──────────────────────────────────────────
      { id: 'g-y1-s1-mat1',    name: 'Matemática I',                        institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'g-y1-s1-sit',     name: 'Sistemas de Informação e Tecnológicos', institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'g-y1-s1-micro',   name: 'Microeconomia',                       institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'g-y1-s1-empresa', name: 'Introdução ao Estudo da Empresa',     institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'g-y1-s1-socio',   name: 'Sociologia Económica',                institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      // ── 1.º ano · 2.º semestre ──────────────────────────────────────────
      { id: 'g-y1-s2-mat2',      name: 'Matemática II',              institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'g-y1-s2-filosofia', name: 'Filosofia Social e Ética',   institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'g-y1-s2-macro',     name: 'Macroeconomia',              institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'g-y1-s2-contfin',   name: 'Contabilidade Financeira',   institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'g-y1-s2-proj1',     name: 'Projeto Multidisciplinar I', institution: 'Católica', course: 'Gestão', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      // ── 2.º ano · 3.º semestre ──────────────────────────────────────────
      { id: 'g-y2-s3-estat',       name: 'Estatística',                                institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'g-y2-s3-moeda',       name: 'Moeda e Mercados Financeiros',               institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'g-y2-s3-ecoempresa',  name: 'Economia da Empresa',                        institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'g-y2-s3-compcontfin', name: 'Complementos de Contabilidade Financeira',   institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'g-y2-s3-proj2',       name: 'Projeto Multidisciplinar II',                institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      // ── 2.º ano · 4.º semestre ──────────────────────────────────────────
      { id: 'g-y2-s4-ecoport',  name: 'Economia Portuguesa e Europeia',            institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'g-y2-s4-financas', name: 'Finanças Empresariais',                     institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'g-y2-s4-direito',  name: 'Direito Empresarial',                       institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'g-y2-s4-metquant', name: 'Métodos Quantitativos Aplicados à Gestão', institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'g-y2-s4-comporg',  name: 'Comportamento Organizacional',              institution: 'Católica', course: 'Gestão', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      // ── 3.º ano · 5.º semestre ──────────────────────────────────────────
      { id: 'g-y3-s5-contgest', name: 'Contabilidade de Gestão',         institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'g-y3-s5-fiscal',   name: 'Fiscalidade',                     institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'g-y3-s5-mktg',     name: 'Gestão de Marketing',             institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'g-y3-s5-historia', name: 'História e Iniciativas Empresariais', institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'g-y3-s5-opti',     name: 'Optativa Livre I',                institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre', isOptional: true, optionalChoices: GESTAO_OPT_I },
      // ── 3.º ano · 6.º semestre ──────────────────────────────────────────
      { id: 'g-y3-s6-gestint',   name: 'Gestão Internacional',  institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'g-y3-s6-gestop',    name: 'Gestão de Operações',   institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'g-y3-s6-estrategia',name: 'Estratégia',            institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'g-y3-s6-optii',     name: 'Optativa Livre II',     institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre', isOptional: true, optionalChoices: GESTAO_OPT_II },
      { id: 'g-y3-s6-projfinal', name: 'Projeto Final Gestão',  institution: 'Católica', course: 'Gestão', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
    ],

    economia: [
      // ── 1.º ano · 1.º semestre ──────────────────────────────────────────
      { id: 'eco-y1-s1-mat1',    name: 'Matemática I',                        institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'eco-y1-s1-sit',     name: 'Sistemas de Informação e Tecnológicos', institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'eco-y1-s1-micro',   name: 'Microeconomia',                       institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'eco-y1-s1-empresa', name: 'Introdução ao Estudo da Empresa',     institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'eco-y1-s1-socio',   name: 'Sociologia Económica',                institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      // ── 1.º ano · 2.º semestre ──────────────────────────────────────────
      { id: 'eco-y1-s2-mat2',      name: 'Matemática II',              institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'eco-y1-s2-filosofia', name: 'Filosofia Social e Ética',   institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'eco-y1-s2-macro',     name: 'Macroeconomia',              institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'eco-y1-s2-contfin',   name: 'Contabilidade Financeira',   institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'eco-y1-s2-proj1',     name: 'Projeto Multidisciplinar I', institution: 'Católica', course: 'Economia', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      // ── 2.º ano · 3.º semestre ──────────────────────────────────────────
      { id: 'eco-y2-s3-estat',    name: 'Estatística',                   institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'eco-y2-s3-moeda',    name: 'Moeda e Mercados Financeiros',  institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'eco-y2-s3-compmicro',name: 'Complementos de Microeconomia', institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'eco-y2-s3-ecodev',   name: 'Economia do Desenvolvimento',   institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'eco-y2-s3-proj2',    name: 'Projeto Multidisciplinar II',   institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      // ── 2.º ano · 4.º semestre ──────────────────────────────────────────
      { id: 'eco-y2-s4-ecoport',   name: 'Economia Portuguesa e Europeia', institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'eco-y2-s4-financas',  name: 'Finanças Empresariais',          institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'eco-y2-s4-direito',   name: 'Direito Empresarial',            institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'eco-y2-s4-econom1',   name: 'Econometria I',                  institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'eco-y2-s4-compmacro', name: 'Complementos de Macroeconomia',  institution: 'Católica', course: 'Economia', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      // ── 3.º ano · 5.º semestre ──────────────────────────────────────────
      { id: 'eco-y3-s5-econom2',  name: 'Econometria II',               institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'eco-y3-s5-ecoint',   name: 'Economia Internacional',       institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'eco-y3-s5-ecopub',   name: 'Economia e Políticas Públicas', institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'eco-y3-s5-ecotrab',  name: 'Economia do Trabalho',         institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'eco-y3-s5-opti',     name: 'Optativa Livre I',             institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre', isOptional: true, optionalChoices: ECONOMIA_OPT_I },
      // ── 3.º ano · 6.º semestre ──────────────────────────────────────────
      { id: 'eco-y3-s6-ecoind',    name: 'Economia Industrial',                    institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'eco-y3-s6-ecofint',   name: 'Economia Financeira Internacional',      institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'eco-y3-s6-histpens',  name: 'História do Pensamento Económico',       institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'eco-y3-s6-optii',     name: 'Optativa Livre II',                      institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre', isOptional: true, optionalChoices: ECONOMIA_OPT_II },
      { id: 'eco-y3-s6-projfinal', name: 'Projeto Final Economia',                 institution: 'Católica', course: 'Economia', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
    ],

    enfermagem: [
      // ── 1.º ano · 1.º semestre ──────────────────────────────────────────
      { id: 'enf-y1-s1-historia',  name: 'História da Enfermagem e da Assistência',             institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-com1',      name: 'Comunicação em Enfermagem I',                         institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-psico',     name: 'Psicologia da Saúde',                                 institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-anat1',     name: 'Anatomia e Fisiologia I',                             institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-patgeral',  name: 'Patologia Geral',                                     institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-bioquim',   name: 'Bioquímica',                                          institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-inv1',      name: 'Investigação em Enfermagem I',                        institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-english',   name: 'English for Nursing',                                 institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-criativ',   name: 'Criatividade e Inovação',                             institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      { id: 'enf-y1-s1-ec1',       name: 'Ensino Clínico 1 — Introdução aos Contextos de Cuidados', institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 1, semesterLabel: '1.º semestre' },
      // ── 1.º ano · 2.º semestre ──────────────────────────────────────────
      { id: 'enf-y1-s2-anat2',     name: 'Anatomia e Fisiologia II',                  institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'enf-y1-s2-corporal',  name: 'Enfermagem e Corporalidade',                institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'enf-y1-s2-nutri',     name: 'Nutrição e Saúde',                          institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'enf-y1-s2-socioantro',name: 'Sócio-antropologia da Saúde',              institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'enf-y1-s2-micro',     name: 'Microbiologia',                             institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'enf-y1-s2-pedag',     name: 'Pedagogia da Saúde',                        institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'enf-y1-s2-patadulto', name: 'Patologia do Adulto e do Idoso',            institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      { id: 'enf-y1-s2-ec2',       name: 'Ensino Clínico 2 — Introdução à Prática de Cuidados', institution: 'Católica', course: 'Enfermagem', year: 1, yearLabel: '1.º ano', semester: 2, semesterLabel: '2.º semestre' },
      // ── 2.º ano · 3.º semestre ──────────────────────────────────────────
      { id: 'enf-y2-s3-adoecer1',  name: 'Enfermagem e Adoecer Humano I',                      institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'enf-y2-s3-adoecer2',  name: 'Enfermagem e Adoecer Humano II',                     institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'enf-y2-s3-etica',     name: 'Ética e Deontologia da Enfermagem',                  institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'enf-y2-s3-farmaco',   name: 'Farmacologia',                                        institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      { id: 'enf-y2-s3-ec3',       name: 'Ensino Clínico 3 — Cuidados à Pessoa com Doença Crónica', institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 3, semesterLabel: '3.º semestre' },
      // ── 2.º ano · 4.º semestre ──────────────────────────────────────────
      { id: 'enf-y2-s4-vida1',    name: 'Enfermagem e Processos de Vida I',            institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'enf-y2-s4-vida2',    name: 'Enfermagem e Processos de Vida II',           institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'enf-y2-s4-patmulher',name: 'Patologia da Mulher e da Criança',           institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'enf-y2-s4-epidemio', name: 'Epidemiologia',                               institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'enf-y2-s4-crista',   name: 'Cristianismo e Cultura',                     institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      { id: 'enf-y2-s4-ec4',      name: 'Ensino Clínico 4 — Cuidados à Pessoa com Doença Aguda', institution: 'Católica', course: 'Enfermagem', year: 2, yearLabel: '2.º ano', semester: 4, semesterLabel: '4.º semestre' },
      // ── 3.º ano · 5.º semestre ──────────────────────────────────────────
      { id: 'enf-y3-s5-com2',     name: 'Comunicação em Enfermagem II',                institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'enf-y3-s5-sistemas', name: 'Sistemas de Informação e Decisão Clínica',   institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'enf-y3-s5-familia',  name: 'Enfermagem, Família e Comunidade',            institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'enf-y3-s5-ec5',      name: 'Ensino Clínico 5 — Cuidados à Família',      institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      { id: 'enf-y3-s5-ec6',      name: 'Ensino Clínico 6 — Cuidados na Parentalidade', institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 5, semesterLabel: '5.º semestre' },
      // ── 3.º ano · 6.º semestre ──────────────────────────────────────────
      { id: 'enf-y3-s6-legis',   name: 'Legislação Profissional',                               institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'enf-y3-s6-epist',   name: 'Epistemologia da Enfermagem',                           institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'enf-y3-s6-estat',   name: 'Estatística',                                            institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'enf-y3-s6-inv2',    name: 'Investigação em Enfermagem II',                          institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'enf-y3-s6-ec7',     name: 'Ensino Clínico 7 — Cuidados à Criança e Adolescente',   institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'enf-y3-s6-ec8',     name: 'Ensino Clínico 8 — Cuidados de Saúde Mental',           institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      { id: 'enf-y3-s6-ec9',     name: 'Ensino Clínico 9 — Cuidados à Pessoa Idosa',            institution: 'Católica', course: 'Enfermagem', year: 3, yearLabel: '3.º ano', semester: 6, semesterLabel: '6.º semestre' },
      // ── 4.º ano · 7.º semestre ──────────────────────────────────────────
      { id: 'enf-y4-s7-gestao',  name: 'Gestão de Cuidados e Supervisão Clínica',   institution: 'Católica', course: 'Enfermagem', year: 4, yearLabel: '4.º ano', semester: 7, semesterLabel: '7.º semestre' },
      { id: 'enf-y4-s7-global',  name: 'Global Nursing',                             institution: 'Católica', course: 'Enfermagem', year: 4, yearLabel: '4.º ano', semester: 7, semesterLabel: '7.º semestre' },
      { id: 'enf-y4-s7-ec10',    name: 'Ensino Clínico 10 — Intervenção na Comunidade', institution: 'Católica', course: 'Enfermagem', year: 4, yearLabel: '4.º ano', semester: 7, semesterLabel: '7.º semestre' },
      // ── 4.º ano · 8.º semestre ──────────────────────────────────────────
      { id: 'enf-y4-s8-integ',   name: 'Integração à Vida Profissional',    institution: 'Católica', course: 'Enfermagem', year: 4, yearLabel: '4.º ano', semester: 8, semesterLabel: '8.º semestre' },
      { id: 'enf-y4-s8-ec11',    name: 'Ensino Clínico 11 — Enfermagem Integral', institution: 'Católica', course: 'Enfermagem', year: 4, yearLabel: '4.º ano', semester: 8, semesterLabel: '8.º semestre' },
      // ── Optativas (available across all years) ───────────────────────────
      { id: 'enf-opt-mktg',      name: 'Marketing Profissional',   institution: 'Católica', course: 'Enfermagem', year: 0, yearLabel: 'Optativas', semester: 0, semesterLabel: 'Optativas', isOptional: true, optionalChoices: ENFERMAGEM_OPT },
      { id: 'enf-opt-terapias',  name: 'Terapias Complementares',  institution: 'Católica', course: 'Enfermagem', year: 0, yearLabel: 'Optativas', semester: 0, semesterLabel: 'Optativas', isOptional: true },
      { id: 'enf-opt-saude',     name: 'Saúde e Comportamentos',   institution: 'Católica', course: 'Enfermagem', year: 0, yearLabel: 'Optativas', semester: 0, semesterLabel: 'Optativas', isOptional: true },
      { id: 'enf-opt-politicas', name: 'Políticas de Saúde',       institution: 'Católica', course: 'Enfermagem', year: 0, yearLabel: 'Optativas', semester: 0, semesterLabel: 'Optativas', isOptional: true },
    ],
  },
};

export function getSubjectsForUser(
  institutionId: string,
  courseId: string,
  year: number,
): Subject[] {
  const all = courseSubjectsByInstitution[institutionId]?.[courseId] ?? [];
  return all.filter((s) => s.year === year || s.year === 0);
}
