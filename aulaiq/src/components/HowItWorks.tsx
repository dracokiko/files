import PhilosopherWatermark from './PhilosopherWatermark';

const steps = [
  {
    number: '01',
    icon: '🏛️',
    title: 'Escolhes a tua faculdade',
    description:
      'Começa por selecionar a tua instituição. O StudyLab já conhece os curricula, professores e estilo de avaliação de cada faculdade.',
  },
  {
    number: '02',
    icon: '📚',
    title: 'Escolhes o curso e as cadeiras',
    description:
      'Define o teu curso e as cadeiras ativas. A plataforma carrega automaticamente os materiais e critérios específicos de cada uma.',
  },
  {
    number: '03',
    icon: '💬',
    title: 'Respondes a algumas perguntas',
    description:
      'Dizes-nos os teus hábitos de estudo, objetivos e preferências. Leva menos de 2 minutos e torna tudo muito mais personalizado.',
  },
  {
    number: '04',
    icon: '🚀',
    title: 'Recebes o teu tutor de IA',
    description:
      'Um plano de estudo completo, chatbot treinado para as tuas cadeiras e quizzes automáticos — tudo ajustado à forma como és avaliado.',
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-24 bg-gray-50 overflow-hidden">
      <PhilosopherWatermark
        src="/images/philosophers/epicurus.png"
        name="ΕΠΙΚΟΥΡΟΣ"
        className="right-4 2xl:right-10 top-1/2 -translate-y-1/2"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-badge mb-4">Como funciona</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
            De zero a plano personalizado{' '}
            <span className="gradient-text">em 4 passos</span>
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            O processo é rápido, intuitivo e pensado para funcionar antes do próximo teste.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-blue-200 via-violet-200 to-blue-200 z-0" />

          {steps.map((step, i) => (
            <div
              key={i}
              className="relative flex flex-col items-start bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 z-10"
            >
              {/* Step number badge */}
              <div className="flex items-center justify-between w-full mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md shadow-blue-100">
                  <span className="text-white font-bold text-sm">{step.number}</span>
                </div>
                <span className="text-2xl">{step.icon}</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug">
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
