import { fetchCadeiraChapters } from '../api/catalog';

export interface Chapter {
  id: string;
  name: string;
}

export async function fetchChaptersForSubject(cadeiraId: string): Promise<{ chapters: Chapter[]; hasMaterial: boolean }> {
  return fetchCadeiraChapters(cadeiraId);
}
