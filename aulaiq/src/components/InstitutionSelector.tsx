import { useState, useMemo, useEffect } from 'react';
import { fetchFaculdades, fetchCursos } from '../api/catalog';
import type { Institution, Course } from '../types';

interface InstitutionSelectorProps {
  onCreatePlan: () => void;
}

export default function InstitutionSelector({ onCreatePlan }: InstitutionSelectorProps) {
  const [query, setQuery] = useState('');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetchFaculdades().then(setInstitutions).catch(() => setInstitutions([]));
  }, []);

  useEffect(() => {
    if (!selectedInstitution) { setCourses([]); return; }
    fetchCursos(selectedInstitution.id).then(setCourses).catch(() => setCourses([]));
  }, [selectedInstitution]);

  const filtered = useMemo(
    () =>
      institutions.filter((inst) =>
        inst.name.toLowerCase().includes(query.toLowerCase()) ||
        inst.description.toLowerCase().includes(query.toLowerCase())
      ),
    [query, institutions]
  );

  const handleSelectInstitution = (inst: Institution) => {
    setSelectedInstitution(inst);
    setSelectedCourse(null);
  };

  return (
    <section id="faculdades" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="section-badge mb-4">Faculdades</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
              Pertences a qual{' '}
              <span className="gradient-text">faculdade?</span>
            </h2>
            <p className="mt-4 text-gray-500">
              Seleciona a tua instituição para ver os cursos disponíveis.
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedInstitution(null);
                setSelectedCourse(null);
              }}
              placeholder="Pesquisar instituição..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Institution grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {filtered.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-400">
                <span className="text-4xl mb-3 block">🔍</span>
                <p className="text-sm">Nenhuma instituição encontrada.</p>
                <p className="text-xs mt-1 text-gray-300">Estamos a expandir — em breve mais faculdades.</p>
              </div>
            ) : (
              filtered.map((inst) => {
                const isSelected = selectedInstitution?.id === inst.id;
                return (
                  <button
                    key={inst.id}
                    onClick={() => handleSelectInstitution(inst)}
                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden transition-colors ${
                        isSelected ? 'bg-gradient-to-br from-blue-500 to-violet-500' : 'bg-gray-100'
                      }`}
                    >
                      {inst.imagemUrl ? (
                        <img src={inst.imagemUrl} alt="" className="w-full h-full object-cover" />
                      ) : isSelected ? (
                        <span className="text-white text-lg font-bold">{inst.logo}</span>
                      ) : (
                        inst.logo
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold text-sm ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {inst.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{inst.description}</p>
                    </div>
                    {isSelected && (
                      <div className="ml-auto flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Course selector — shown after institution selected */}
          {selectedInstitution && (
            <div className="animate-slide-up">
              <div className="border-t border-gray-100 pt-6 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Escolhe o teu curso em{' '}
                  <span className="text-blue-600">{selectedInstitution.name}</span>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {courses.map((course) => {
                    const isSelected = selectedCourse?.id === course.id;
                    return (
                      <button
                        key={course.id}
                        onClick={() => setSelectedCourse(isSelected ? null : course)}
                        className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm'
                            : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {course.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA — shown after course selected */}
              {selectedCourse && (
                <div className="animate-slide-up">
                  <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-6 border border-blue-100 text-center">
                    <p className="text-sm text-gray-500 mb-1">Pronto para começar em</p>
                    <p className="text-base font-bold text-gray-900 mb-4">
                      {selectedInstitution.name} · {selectedCourse.name}
                    </p>
                    <button onClick={onCreatePlan} className="btn-primary mx-auto">
                      Criar plano personalizado
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Coming soon note */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Mais instituições em breve. Tens interesse noutras faculdades?{' '}
            <a href="mailto:hello@studylab.pt" className="text-blue-500 hover:underline">
              Diz-nos.
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
