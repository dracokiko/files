import { pricingPlans } from '../data/pricing';

interface PricingProps {
  onSelectPlan: () => void;
}

function handlePlanClick(stripeUrl: string | undefined, fallback: () => void) {
  if (stripeUrl) {
    window.location.href = stripeUrl;
  } else {
    fallback();
  }
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
    <section id="planos" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-badge mb-4">Planos</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
            Preços simples e{' '}
            <span className="gradient-text">sem surpresas</span>
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Começa com o teste de 7 dias. Sem cartão de crédito.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          {pricingPlans.map((plan) =>
            plan.highlighted ? (
              /* Highlighted card — gradient border wrapper */
              <div key={plan.id} className="relative">
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-full shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-px shadow-xl shadow-blue-200 h-full">
                  <div className="bg-white rounded-[15px] p-7 flex flex-col h-full">
                    <div>
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
                      onClick={() => handlePlanClick(plan.stripeUrl, onSelectPlan)}
                      className="mt-8 w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.02] transition-all duration-200"
                    >
                      {plan.cta}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Regular card */
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
                  onClick={() => handlePlanClick(plan.stripeUrl, onSelectPlan)}
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
