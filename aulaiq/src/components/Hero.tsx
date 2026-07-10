import PhilosopherWatermark from './PhilosopherWatermark';

interface HeroProps {
  onStart: () => void;
  onPlans: () => void;
}

function MockupCard() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Ambient glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 to-violet-400 opacity-15 blur-3xl rounded-3xl" />

      {/* Main card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Card header */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">StudyLab</p>
              <p className="text-blue-100 text-xs">Tutor ativo · Microeconomia I</p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white text-xs font-medium">Online</span>
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div className="px-5 pt-4 pb-2 space-y-1">
          {[
            { label: 'Faculdade', value: 'Católica' },
            { label: 'Curso', value: 'Gestão' },
            { label: 'Cadeira', value: 'Microeconomia I' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-400 font-medium">{label}</span>
              <span className="text-xs font-semibold text-gray-800">{value}</span>
            </div>
          ))}
        </div>

        {/* Status items */}
        <div className="px-5 py-3 space-y-2">
          {[
            { icon: '🤖', label: 'AI Tutor', status: 'Online', color: 'bg-green-50 text-green-600' },
            { icon: '📝', label: 'Quiz gerado', status: '15 perguntas', color: 'bg-blue-50 text-blue-600' },
            { icon: '📅', label: 'Plano de estudo', status: 'Pronto', color: 'bg-violet-50 text-violet-600' },
          ].map(({ icon, label, status, color }) => (
            <div
              key={label}
              className="flex items-center justify-between bg-gray-50/80 rounded-xl px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{icon}</span>
                <span className="text-xs font-medium text-gray-700">{label}</span>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${color}`}>
                {status}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-5 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">Progresso do módulo</span>
            <span className="text-xs font-bold text-blue-600">68%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-[68%] bg-gradient-to-r from-blue-500 to-violet-500 rounded-full" />
          </div>
        </div>
      </div>

      {/* Floating badge — top right */}
      <div className="absolute -top-4 -right-3 bg-white rounded-2xl shadow-lg px-3.5 py-2.5 border border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <div>
            <p className="text-xs font-bold text-gray-900">+45 XP</p>
            <p className="text-[10px] text-gray-400 leading-none">Quiz completo</p>
          </div>
        </div>
      </div>

      {/* Floating badge — bottom left */}
      <div className="absolute -bottom-4 -left-3 bg-white rounded-2xl shadow-lg px-3.5 py-2.5 border border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-xs font-bold text-gray-900">Frequência amanhã</p>
            <p className="text-[10px] text-gray-400 leading-none">Plano pronto!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero({ onStart, onPlans }: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white pt-16">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-50 to-violet-50 rounded-full -translate-y-1/4 translate-x-1/4 opacity-60" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-50 to-blue-50 rounded-full translate-y-1/4 -translate-x-1/4 opacity-60" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <PhilosopherWatermark
          src="/images/philosophers/socrates.png"
          name="ΣΩΚΡΑΤΗΣ"
          className="left-4 2xl:left-10 bottom-6"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left column — copy */}
          <div className="text-center lg:text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full mb-8">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-blue-700">Já disponível para Católica</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.05] tracking-tight">
              A tua faculdade.{' '}
              <span className="block">As tuas cadeiras.</span>
              <span className="block mt-1">
                Um tutor de IA{' '}
                <span className="gradient-text">feito à tua medida.</span>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg sm:text-xl text-gray-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Estuda com quizzes, planos personalizados e chatbots treinados para cada cadeira, curso e estilo de avaliação.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button onClick={onStart} className="btn-primary text-base !px-7 !py-3.5">
                Começar agora
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <button onClick={onPlans} className="btn-secondary text-base !px-7 !py-3.5">
                Ver planos
              </button>
            </div>

            {/* Trust line */}
            <div className="mt-10 flex items-start gap-3 justify-center lg:justify-start max-w-md mx-auto lg:mx-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed text-left">
                <span className="font-semibold text-gray-700">A primeira plataforma feita para estudar como os teus professores realmente avaliam.</span>
              </p>
            </div>

            {/* Social proof */}
            <div className="mt-8 flex items-center gap-4 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {['B', 'M', 'J', 'A', 'R'].map((initial, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 border-2 border-white flex items-center justify-center"
                  >
                    <span className="text-white text-xs font-bold">{initial}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">+200 estudantes</span> já estão a usar o StudyLab
              </p>
            </div>
          </div>

          {/* Right column — mockup */}
          <div className="flex justify-center lg:justify-end animate-fade-in">
            <MockupCard />
          </div>
        </div>
      </div>
    </section>
  );
}
