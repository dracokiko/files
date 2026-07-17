import { useEffect, useState } from 'react';
import { fetchFaculdades, fetchCursos, fetchCadeiras } from '../../api/catalog';
import { updateCourse, ProfileApiError } from '../../services/profileApi';
import type { UserProfile, Institution, Course } from '../../types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon',
  });
}

const selectClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 ' +
  'outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200 ' +
  'disabled:opacity-60';

interface ChangeCourseCardProps {
  user: UserProfile;
  eligible: boolean;
  availableAt: string | null;
  loadingEligibility: boolean;
  onUpdated: (profile: UserProfile) => void;
}

export default function ChangeCourseCard({
  user, eligible, availableAt, loadingEligibility, onUpdated,
}: ChangeCourseCardProps) {
  const [editing, setEditing] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [availableYears, setAvailableYears] = useState<Array<{ value: number; label: string }>>([]);
  const [instId, setInstId] = useState(user.institutionId);
  const [courseId, setCourseId] = useState(user.courseId);
  const [year, setYear] = useState<number | null>(user.year);
  const [yearLabel, setYearLabel] = useState(user.yearLabel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedInst = institutions.find((i) => i.id === instId) ?? null;
  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  useEffect(() => {
    if (!editing) return;
    fetchFaculdades().then(setInstitutions).catch(() => setInstitutions([]));
  }, [editing]);

  useEffect(() => {
    if (!editing || !instId) { setCourses([]); return; }
    fetchCursos(instId).then(setCourses).catch(() => setCourses([]));
  }, [editing, instId]);

  useEffect(() => {
    if (!editing || !courseId || !selectedInst || !selectedCourse) { setAvailableYears([]); return; }
    fetchCadeiras(courseId, selectedInst.name, selectedCourse.name)
      .then((subjects) => {
        const seen = new Map<number, string>();
        for (const s of subjects) {
          if (s.year > 0 && !seen.has(s.year)) seen.set(s.year, s.yearLabel);
        }
        setAvailableYears(
          Array.from(seen.entries()).sort(([a], [b]) => a - b).map(([value, label]) => ({ value, label })),
        );
      })
      .catch(() => setAvailableYears([]));
  }, [editing, courseId, selectedInst, selectedCourse]);

  const openEditor = () => {
    setInstId(user.institutionId);
    setCourseId(user.courseId);
    setYear(user.year);
    setYearLabel(user.yearLabel);
    setError('');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!instId || !courseId || year === null) {
      setError('Seleciona faculdade, curso e ano.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const profile = await updateCourse({
        institutionId: instId,
        institutionName: selectedInst?.name ?? user.institution,
        courseId,
        courseName: selectedCourse?.name ?? user.course,
        year,
        yearLabel,
      });
      onUpdated(profile);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ProfileApiError ? err.message : 'Não foi possível guardar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-gray-900">Curso e ano</h2>
        {!editing && eligible && !loadingEligibility && (
          <button type="button" onClick={openEditor} className="text-sm font-semibold text-blue-600 hover:underline">
            Alterar
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <p className="text-sm text-gray-600 mt-2">{user.institution} · {user.course} · {user.yearLabel}</p>
          {!loadingEligibility && !eligible && availableAt && (
            <p className="text-xs text-amber-600 mt-3">
              Já alteraste o curso/ano recentemente. Podes voltar a alterar a partir de {formatDate(availableAt)}.
            </p>
          )}
          {!loadingEligibility && eligible && (
            <p className="text-xs text-gray-400 mt-3">
              Podes alterar o curso/ano uma vez por mês (sem limite nas primeiras 24h após o registo, caso te
              tenhas enganado).
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Faculdade</label>
            <select
              value={instId}
              onChange={(e) => { setInstId(e.target.value); setCourseId(''); setYear(null); setYearLabel(''); }}
              className={selectClass}
            >
              <option value="" disabled>Seleciona...</option>
              {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Curso</label>
            <select
              value={courseId}
              onChange={(e) => { setCourseId(e.target.value); setYear(null); setYearLabel(''); }}
              disabled={!instId}
              className={selectClass}
            >
              <option value="" disabled>Seleciona...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
            <select
              value={year ?? ''}
              onChange={(e) => {
                const v = Number(e.target.value);
                setYear(v);
                setYearLabel(availableYears.find((y) => y.value === v)?.label ?? '');
              }}
              disabled={!courseId}
              className={selectClass}
            >
              <option value="" disabled>Seleciona...</option>
              {availableYears.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'A guardar...' : 'Guardar'}
            </button>
          </div>

          <p className="text-xs text-amber-600">
            Só poderás voltar a alterar daqui a 30 dias (exceto se ainda estiveres nas primeiras 24h após o registo).
          </p>
        </div>
      )}
    </div>
  );
}
