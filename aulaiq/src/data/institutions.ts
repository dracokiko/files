import type { Institution, Course } from '../types';

// TODO: Backend integration — fetch from GET /api/institutions
export const institutions: Institution[] = [
  {
    id: 'catolica',
    name: 'Católica',
    description: 'Universidade Católica Portuguesa',
    logo: '⚜️',
  },
  // More institutions will be added as the platform expands.
];

// TODO: Backend integration — fetch from GET /api/institutions/:id/courses
export const coursesByInstitution: Record<string, Course[]> = {
  catolica: [
    { id: 'gestao', name: 'Gestão', institutionId: 'catolica' },
    { id: 'economia', name: 'Economia', institutionId: 'catolica' },
    { id: 'enfermagem', name: 'Enfermagem', institutionId: 'catolica' },
  ],
};
