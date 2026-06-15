const features = [
  {
    icon: '🤖',
    title: 'Chatbot por cadeira',
    description:
      'Um assistente de IA treinado especificamente para cada cadeira do teu curso — não respostas genéricas, mas contexto real da tua ementa.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: '📝',
    title: 'Quizzes automáticos',
    description:
      'Gera quizzes instantâneos baseados nos temas que precisas de rever. Adapta a dificuldade conforme o teu progresso.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: '📅',
    title: 'Planos de estudo personalizados',
    description:
      'Um plano semanal criado com base nos teus hábitos, objetivos e nas datas dos teus exames. Nada genérico.',
    color: 'from-blue-600 to-violet-600',
  },
  {
    icon: '🎯',
    title: 'Critérios dos professores',
    description:
      'Quando disponível, usamos correções, critérios e padrões reais de avaliação para aproximar o estudo da forma como és avaliado.',
    color: 'from-orange-400 to-rose-500',
    highlight: true,
  },
  {
    icon: '📂',
    title: 'Materiais organizados',
    description:
      'Slides, PDFs, PowerPoints e resumos disponíveis numa base de conhecimento organizada por tema — sem procurar em 5 sítios diferentes.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: '⚡',
    title: 'Revisão antes de exames',
    description:
      'Modo exame: simulações, flashcards dos tópicos mais prováveis e um resumo das correções anteriores do professor.',
    color: 'from-amber-500 to-orange-500',
  },
];

export default function Features() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-badge mb-4">Funcionalidades</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
            Tudo o que precisas para{' '}
            <span className="gradient-text">estudar melhor</span>
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Cada funcionalidade foi desenhada com um objetivo: que estudes menos tempo, mas de forma mais eficaz.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden ${
                feature.highlight ? 'border-blue-100' : ''
              }`}
            >
              {/* Background glow on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 rounded-2xl`} />

              <div className={`inline-flex w-11 h-11 rounded-2xl bg-gradient-to-br ${feature.color} items-center justify-center text-xl shadow-sm mb-4`}>
                {feature.icon}
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>

              {feature.highlight && (
                <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 rounded-full">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span className="text-xs text-blue-600 font-medium">Quando disponível</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
