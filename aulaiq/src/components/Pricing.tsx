import { pricingPlans } from '../data/pricing';
import PhilosopherWatermark from './PhilosopherWatermark';

interface PricingProps {
  onSelectPlan: (planId?: 'essential' | 'team') => void;
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function Pricing({ onSelectPlan }: PricingProps) {
  return (
    <section id="planos" className="relative py-24 bg-gray-50 overflow-hidden">
      <PhilosopherWatermark
        src="/images/philosophers/hypatia.png"
        name="ὙΠΑΤΙΑ"
        className="left-4 2xl:left-10 top-10"
        imgClassName="w-[192px] 2xl:w-[230px]"
      />
      <PhilosopherWatermark
        src="/images/philosophers/aristotle.png"
        name="ΑΡΙΣΤΟΤΈΛΗΣ"
        className="right-4 2xl:right-45 top-10"
        imgClassName="w-[192px] 2xl:w-[230px]"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-badge mb-4">Planos</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
            Preços simples e{' '}
            <span className="gradient-text">sem surpresas</span>
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Começa grátis. Quando quiseres mais, escolhe o plano certo para ti.
          </p>
        </div>

        {/* Free plan strip */}
        <div className="max-w-5xl mx-auto mb-6">
          <div className="bg-white border border-gray-200 rounded-2xl px-7 py-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="text-sm font-bold text-gray-900">Plano Grátis</span>
              <span className="ml-3 text-2xl font-black text-gray-900">0€</span>
              <span className="text-sm text-gray-400 ml-1">para sempre</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2"><CheckIcon /><span>10 mensagens por dia</span></div>
              <div className="flex items-center gap-2"><CheckIcon /><span>1 cadeira por dia</span></div>
              <div className="flex items-center gap-2"><CheckIcon /><span>Acesso ao chatbot</span></div>
            </div>
            <button
              onClick={() => onSelectPlan()}
              className="text-sm font-semibold text-gray-600 border border-gray-200 px-5 py-2.5 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 whitespace-nowrap"
            >
              Criar conta grátis
            </button>
          </div>
        </div>

        {/* Paid plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto items-stretch">
          {pricingPlans.map((plan) =>
            plan.highlighted ? (
              <div key={plan.id} className="relative">
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-full shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-px shadow-xl shadow-blue-200 h-full">
                  <div className="bg-white rounded-[15px] p-7 flex flex-col h-full">
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                        <span className="text-sm text-gray-400">/ {plan.period}</span>
                      </div>
                      <ul className="mt-6 space-y-3">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckIcon />
                            <span className="text-sm text-gray-600">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => onSelectPlan(plan.id as 'essential' | 'team')}
                      className="mt-8 w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.02] transition-all duration-200"
                    >
                      {plan.cta}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-gray-200 p-7 flex flex-col hover:shadow-md hover:border-gray-300 transition-all duration-200"
              >
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-400">/ {plan.period}</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckIcon />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => onSelectPlan(plan.id as 'essential' | 'team')}
                  className="mt-8 w-full py-3 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                >
                  {plan.cta}
                </button>
              </div>
            )
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-10">
          Todos os planos incluem acesso à base de materiais e atualizações automáticas de conteúdo.
        </p>
      </div>
    </section>
  );
}
