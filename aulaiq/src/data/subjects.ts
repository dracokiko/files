import type { Subject } from '../types';
import { fetchCadeiras } from '../api/catalog';

export async function getSubjectsForUser(
  institutionName: string,
  courseId: string,
  courseName: string,
  year: number,
): Promise<Subject[]> {
  const all = await fetchCadeiras(courseId, institutionName, courseName);
  return all.filter((s) => s.year === year || s.year === 0);
}
