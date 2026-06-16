import { useState, useCallback } from 'react';
import { institutions, coursesByInstitution } from '../data/institutions';
import { validYearsByCourse } from '../data/subjects';
import { createDemoProfile, getStudyPlanSuggestion } from '../utils/auth';
import type { UserProfile } from '../types';

interface OnboardingModalProps {
  onClose: () => void;
  onComplete: (profile: UserProfile) => void;
}

// Step sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-gradient-to-r from-blue-500 to-violet-500 w-6'
              : i === current
              ? 'bg-blue-400 w-8'
              : 'bg-gray-200 w-4'
          }`}
        />
      ))}
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
          }`}
        >
          {selected && (
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          )}
        </div>
        {children}
      </div>
    </button>
  );
}

function InputField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 ${
          error
            ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-50'
            : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function OnboardingModal({ onClose, onComplete }: OnboardingModalProps) {
  const TOTAL_STEPS = 5;

  const [step, setStep] = useState(0);
  const [instId, setInstId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [yearLabel, setYearLabel] = useState('');
  const [studyFrequency, setStudyFrequency] = useState('');
  const [studyHours, setStudyHours] = useState('');
  const [mainGoal, setMainGoal] = useState('');
  const [studyStyle, setStudyStyle] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const selectedInst = institutions.find((i) => i.id === instId) ?? null;
  const courses = instId ? (coursesByInstitution[instId] ?? []) : [];
  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;
  const availableYears = courseId ? (validYearsByCourse[courseId] ?? []) : [];

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};

    if (step === 0 && !instId) errs.inst = 'Seleciona uma faculdade para continuar.';

    if (step === 1 && !courseId) errs.course = 'Seleciona um curso para continuar.';

    if (step === 2 && year === null) errs.year = 'Seleciona o teu ano para continuar.';

    if (step === 3) {
      if (!studyFrequency) errs.studyFrequency = 'Escolhe uma opção.';
      if (!studyHours) errs.studyHours = 'Escolhe uma opção.';
      if (!mainGoal) errs.mainGoal = 'Escolhe uma opção.';
      if (!studyStyle) errs.studyStyle = 'Escolhe uma opção.';
    }

    if (step === 4) {
      if (!name.trim()) errs.name = 'Insere o teu nome.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Insere um email válido.';
      if (password.length < 8) errs.password = 'Password deve ter pelo menos 8 caracteres.';
      if (password !== confirmPassword) errs.confirmPassword = 'As passwords não coincidem.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, instId, courseId, year, studyFrequency, studyHours, mainGoal, studyStyle, name, email, password, confirmPassword]);

  const handleNext = () => {
    if (!validate()) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Final step — create profile on free plan; success screen offers trial upgrade
    // TODO: Production — POST /api/auth/register with hashed password (never plain text)
    const created = createDemoProfile({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      institutionId: instId,
      institutionName: selectedInst?.name ?? instId,
      courseId,
      courseName: selectedCourse?.name ?? courseId,
      year: year!,
      yearLabel,
      plan: 'free',
      preferences: { studyFrequency, studyHours, mainGoal, studyStyle },
    });
    setProfile(created);
    setStep(TOTAL_STEPS); // success screen
  };

  const suggestion = profile ? getStudyPlanSuggestion(profile.preferences) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Success screen */}
        {step === TOTAL_STEPS && profile && suggestion ? (
          <div className="p-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-1">Plano StudyLab criado!</h2>
            <p className="text-gray-500 text-sm mb-8">O teu tutor está pronto, {profile.name.split(' ')[0]}.</p>

            <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-5 mb-6 text-left border border-blue-100">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Faculdade</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{profile.institution}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Curso</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{profile.course}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Ano</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{profile.yearLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Objetivo</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{profile.preferences.mainGoal}</p>
                </div>
              </div>

              <div className="border-t border-blue-100 pt-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ritmo recomendado</p>
                  <p className="text-sm text-gray-700">{suggestion.rhythm}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plano sugerido</p>
                  <p className="text-sm text-gray-700">{suggestion.plan}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => { onComplete({ ...profile, plan: 'trial' }); }}
              className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01] transition-all duration-200"
            >
              Ativar teste de 7 dias — 6€
            </button>
            <p className="text-xs text-gray-400 mt-3">Sem compromisso. Cancela quando quiseres.</p>
            <button
              onClick={() => { onComplete(profile); }}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Continuar com plano grátis
            </button>
          </div>
        ) : (
          /* Multi-step form */
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <StepIndicator current={step} total={TOTAL_STEPS} />
                <p className="text-xs text-gray-400 mt-2">
                  Passo {step + 1} de {TOTAL_STEPS}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                <span className="text-white font-black text-sm">A</span>
              </div>
            </div>

            {/* Step 0 — Institution */}
            {step === 0 && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-black text-gray-900 mb-1">Local de ensino</h2>
                <p className="text-sm text-gray-500 mb-6">Qual é a tua instituição?</p>

                <div className="space-y-3">
                  {institutions.map((inst) => {
                    const isSelected = instId === inst.id;
                    return (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => { setInstId(inst.id); setErrors({}); }}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all duration-150 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          {inst.logo}
                        </span>
                        <div>
                          <p className={`font-bold text-sm ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{inst.name}</p>
                          <p className="text-xs text-gray-400">{inst.description}</p>
                        </div>
                        {isSelected && (
                          <div className="ml-auto w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {errors.inst && <p className="mt-3 text-xs text-red-500">{errors.inst}</p>}
                <p className="text-xs text-gray-400 mt-4 text-center">Mais instituições em breve.</p>
              </div>
            )}

            {/* Step 1 — Course */}
            {step === 1 && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-black text-gray-900 mb-1">O teu curso</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Cursos disponíveis em{' '}
                  <span className="font-semibold text-blue-600">{selectedInst?.name}</span>:
                </p>

                <div className="space-y-2">
                  {courses.map((course) => {
                    const isSelected = courseId === course.id;
                    return (
                      <OptionButton
                        key={course.id}
                        selected={isSelected}
                        onClick={() => {
                          setCourseId(course.id);
                          setYear(null);
                          setYearLabel('');
                          setErrors({});
                        }}
                      >
                        {course.name}
                      </OptionButton>
                    );
                  })}
                </div>
                {errors.course && <p className="mt-3 text-xs text-red-500">{errors.course}</p>}
              </div>
            )}

            {/* Step 2 — Year */}
            {step === 2 && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-black text-gray-900 mb-1">O teu ano</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Em que ano estás em{' '}
                  <span className="font-semibold text-blue-600">{selectedCourse?.name}</span>?
                </p>

                <div className="space-y-2">
                  {availableYears.map((y) => {
                    const isSelected = year === y.value;
                    return (
                      <OptionButton
                        key={y.value}
                        selected={isSelected}
                        onClick={() => {
                          setYear(y.value);
                          setYearLabel(y.label);
                          setErrors({});
                        }}
                      >
                        {y.label}
                      </OptionButton>
                    );
                  })}
                </div>
                {errors.year && <p className="mt-3 text-xs text-red-500">{errors.year}</p>}
                <p className="text-xs text-gray-400 mt-4">
                  Podes alterar o ano a qualquer momento no teu perfil.
                </p>
              </div>
            )}

            {/* Step 3 — Study habits */}
            {step === 3 && (
              <div className="animate-fade-in space-y-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900 mb-1">Hábitos de estudo</h2>
                  <p className="text-sm text-gray-500">Ajuda-nos a personalizar o teu plano.</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Quantas vezes estudas por semana?</p>
                  <div className="space-y-2">
                    {['1-2', '3-4', '5+'].map((opt) => (
                      <OptionButton key={opt} selected={studyFrequency === opt} onClick={() => { setStudyFrequency(opt); setErrors((e) => ({ ...e, studyFrequency: '' })); }}>
                        {opt === '1-2' ? '1–2 vezes' : opt === '3-4' ? '3–4 vezes' : '5 ou mais vezes'}
                      </OptionButton>
                    ))}
                  </div>
                  {errors.studyFrequency && <p className="mt-1.5 text-xs text-red-500">{errors.studyFrequency}</p>}
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Quantas horas estudas por sessão?</p>
                  <div className="space-y-2">
                    {[
                      { val: 'Menos de 1h', label: 'Menos de 1h' },
                      { val: '1-2h', label: '1–2 horas' },
                      { val: '2-4h', label: '2–4 horas' },
                      { val: 'Mais de 4h', label: 'Mais de 4 horas' },
                    ].map(({ val, label }) => (
                      <OptionButton key={val} selected={studyHours === val} onClick={() => { setStudyHours(val); setErrors((e) => ({ ...e, studyHours: '' })); }}>
                        {label}
                      </OptionButton>
                    ))}
                  </div>
                  {errors.studyHours && <p className="mt-1.5 text-xs text-red-500">{errors.studyHours}</p>}
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Qual é o teu objetivo principal?</p>
                  <div className="space-y-2">
                    {['Passar à cadeira', 'Melhorar média', 'Preparar exame', 'Estudar com menos stress'].map((opt) => (
                      <OptionButton key={opt} selected={mainGoal === opt} onClick={() => { setMainGoal(opt); setErrors((e) => ({ ...e, mainGoal: '' })); }}>
                        {opt}
                      </OptionButton>
                    ))}
                  </div>
                  {errors.mainGoal && <p className="mt-1.5 text-xs text-red-500">{errors.mainGoal}</p>}
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Preferes estudar como?</p>
                  <div className="space-y-2">
                    {['Resumos', 'Quizzes', 'Explicações passo a passo', 'Mistura de tudo'].map((opt) => (
                      <OptionButton key={opt} selected={studyStyle === opt} onClick={() => { setStudyStyle(opt); setErrors((e) => ({ ...e, studyStyle: '' })); }}>
                        {opt}
                      </OptionButton>
                    ))}
                  </div>
                  {errors.studyStyle && <p className="mt-1.5 text-xs text-red-500">{errors.studyStyle}</p>}
                </div>
              </div>
            )}

            {/* Step 4 — Account creation */}
            {step === 4 && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900 mb-1">Cria a tua conta</h2>
                  <p className="text-sm text-gray-500">Guarda o teu plano e acede a qualquer momento.</p>
                </div>

                {/* TODO: Production — collect email + password and send to POST /api/auth/register
                    Use Supabase: supabase.auth.signUp({ email, password })
                    Or Firebase: createUserWithEmailAndPassword(auth, email, password)
                    NEVER store passwords in localStorage or any client-side storage. */}

                <InputField
                  label="Nome completo"
                  value={name}
                  onChange={setName}
                  error={errors.name}
                  placeholder="O teu nome"
                />
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  error={errors.email}
                  placeholder="tu@email.com"
                />
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  error={errors.password}
                  placeholder="Mínimo 8 caracteres"
                />
                <InputField
                  label="Confirmar password"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  error={errors.confirmPassword}
                  placeholder="Repete a password"
                />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Ao criares uma conta aceitas os nossos{' '}
                  <a href="#" className="text-blue-500 hover:underline">Termos de Serviço</a>{' '}
                  e{' '}
                  <a href="#" className="text-blue-500 hover:underline">Política de Privacidade</a>.
                </p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 mt-8">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => { setStep((s) => s - 1); setErrors({}); }}
                  className="px-5 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01] transition-all duration-200"
              >
                {step === TOTAL_STEPS - 1 ? 'Criar conta' : 'Continuar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
