import type { Institution, Course, Subject } from '../types';
import type { Chapter } from '../data/chapters';

interface FaculdadeRow {
  id: string;
  nome: string;
  imagem_url: string | null;
}

interface CursoRow {
  id: string;
  nome: string;
  imagem_url: string | null;
  duracao_anos: number | null;
}

interface CadeiraRow {
  id: string;
  nome: string;
  year: number | null;
  year_label: string | null;
  semester: number | null;
  semester_label: string | null;
  is_optional: boolean;
  optional_group: string | null;
}

export async function fetchFaculdades(): Promise<Institution[]> {
  const res = await fetch('/api/faculdades');
  if (!res.ok) throw new Error('Erro ao carregar faculdades.');
  const rows: FaculdadeRow[] = await res.json();
  return rows.map((r) => ({
    id: r.id,
    name: r.nome,
    description: '',
    logo: '🏫',
    imagemUrl: r.imagem_url ?? undefined,
  }));
}

export async function fetchCursos(faculdadeId: string): Promise<Course[]> {
  const res = await fetch(`/api/cursos?faculdade_id=${encodeURIComponent(faculdadeId)}`);
  if (!res.ok) throw new Error('Erro ao carregar cursos.');
  const rows: CursoRow[] = await res.json();
  return rows.map((r) => ({ id: r.id, name: r.nome, institutionId: faculdadeId, durationYears: r.duracao_anos ?? 3 }));
}

// Maps a real cadeira row to the existing Subject shape so components that
// already read Subject.id/.name/.year/... need no changes.
function toSubject(row: CadeiraRow, institutionName: string, courseName: string): Subject {
  return {
    id: row.id,
    name: row.nome,
    institution: institutionName,
    course: courseName,
    year: row.year ?? 0,
    yearLabel: row.year_label ?? '',
    semester: row.semester ?? 0,
    semesterLabel: row.semester_label ?? '',
    isOptional: row.is_optional,
    optionalGroup: row.optional_group ?? undefined,
  };
}

export async function fetchCadeiras(
  cursoId: string,
  institutionName: string,
  courseName: string,
  year?: number,
): Promise<Subject[]> {
  const params = new URLSearchParams({ curso_id: cursoId });
  if (year != null) params.set('year', String(year));
  const res = await fetch(`/api/cadeiras?${params}`);
  if (!res.ok) throw new Error('Erro ao carregar cadeiras.');
  const rows: CadeiraRow[] = await res.json();
  return rows.map((r) => toSubject(r, institutionName, courseName));
}

export async function fetchCadeiraChapters(cadeiraId: string): Promise<{ chapters: Chapter[]; hasMaterial: boolean }> {
  const res = await fetch(`/api/cadeiras/${encodeURIComponent(cadeiraId)}/chapters`);
  if (!res.ok) throw new Error('Erro ao carregar capítulos.');
  const data: { chapters: { id: string; chapter_no: number; title: string }[]; has_material: boolean } = await res.json();
  return {
    chapters: data.chapters.map((c) => ({ id: c.id, name: c.title })),
    hasMaterial: data.has_material,
  };
}
