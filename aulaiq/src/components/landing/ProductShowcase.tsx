import PhilosopherWatermark from '../PhilosopherWatermark';

export default function ProductShowcase() {
  return (
    <section className="relative py-24 bg-gray-50">
      <PhilosopherWatermark
        src="/images/philosophers/socrates.png"
        name="ΣΩΚΡΑΤΗΣ"
        className="left-4 2xl:left-10 top-[-95px]"
        imgClassName="w-[224px] 2xl:w-[269px]"
      />
      <PhilosopherWatermark
        src="/images/philosophers/athena.png"
        name="ΑΘΗΝΑ"
        className="right-4 2xl:right-10 top-[-88px]"
        imgClassName="w-[224px] 2xl:w-[269px]"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-badge mb-4">Como funciona</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
            Estudar já não é só{' '}
            <span className="gradient-text">ler resumos.</span>
          </h2>
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1 — Tutor IA */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 mb-3">Tutor por cadeira</h3>

            {/* Chat preview */}
            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              <div className="flex justify-end">
                <div className="bg-gradient-to-br from-blue-500 to-violet-500 text-white text-xs px-3 py-2 rounded-2xl rounded-br-md max-w-[80%]">
                  Explica-me elasticidade-preço da procura.
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 text-gray-700 text-xs px-3 py-2 rounded-2xl rounded-bl-md max-w-[85%] shadow-sm">
                  Claro. Vou explicar como a tua cadeira costuma avaliar isto…
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 — Quizzes */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 mb-3">Quizzes por capítulo</h3>

            {/* Progress example */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-medium">Microeconomia › Elasticidades</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" />
                </div>
                <span className="text-xs font-bold text-emerald-600">Nível 4</span>
              </div>
              <div className="flex gap-1.5 mt-3">
                {['✓', '✓', '✓', '✓', '○'].map((s, i) => (
                  <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    s === '✓' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-300'
                  }`}>
                    {s}
                  </div>
                ))}
                <div className="ml-1 text-xs text-gray-400 self-center">4/5 corretas · +75 XP</div>
              </div>
            </div>
          </div>

          {/* Card 3 — Buddies */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 mb-3">Ranking com buddies</h3>

            {/* Mini leaderboard */}
            <div className="space-y-2">
              {[
                { rank: 1, name: 'Inês', xp: 720, isYou: false },
                { rank: 2, name: 'Tu', xp: 640, isYou: true },
                { rank: 3, name: 'Miguel', xp: 590, isYou: false },
              ].map((entry) => (
                <div key={entry.rank} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                  entry.isYou ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-xs ${
                    entry.rank === 1 ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{entry.rank}</span>
                  <span className={`flex-1 font-semibold ${entry.isYou ? 'text-blue-700' : 'text-gray-700'}`}>
                    {entry.name}
                  </span>
                  <span className="font-bold text-gray-600">{entry.xp} XP</span>
                </div>
              ))}
              <p className="text-xs text-amber-600 font-medium pt-1 px-1">
                Estás a 80 XP de passar a Inês em Microeconomia.
              </p>
            </div>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { label: '+340 XP esta semana', icon: '⚡' },
            { label: 'Nível 6 em Matemática I', icon: '🏆' },
            { label: '3 capítulos dominados', icon: '✅' },
            { label: '20 mensagens/dia no plano grátis', icon: '💬' },
          ].map((pill) => (
            <div
              key={pill.label}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm text-sm font-medium text-gray-700"
            >
              <span>{pill.icon}</span>
              {pill.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
