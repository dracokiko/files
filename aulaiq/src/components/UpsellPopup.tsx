import { useState } from 'react';
import { startCheckout, type PaidPlanId } from '../utils/checkout';
import { pricingPlans } from '../data/pricing';

interface UpsellPopupProps {
  onClose: () => void;
}

const GADGETS = [
  'Quizzes com XP',
  'Níveis por cadeira',
  'Capítulos com mastery',
  'Buddies e ranking',
  'Materiais premium',
  'Correções e critérios quando disponíveis',
];

export default function UpsellPopup({ onClose }: UpsellPopupProps) {
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleActivate = async (planId: PaidPlanId) => {
    setLoadingPlan(planId);
    setCheckoutError(null);
    const { error } = await startCheckout(planId);
    if (error) setCheckoutError(error);
    setLoadingPlan(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-slide-up">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h3 className="text-lg font-black text-gray-900 text-center mb-2">
          Queres subir de nível a sério?
        </h3>
        <p className="text-sm text-gray-500 text-center mb-5 leading-relaxed">
          No plano grátis consegues testar o tutor numa cadeira por dia. Para ganhar XP com quizzes, desbloquear capítulos, comparar-te com buddies e treinar como em exame, ativa um plano pago.
        </p>

        <div className="space-y-2 mb-6">
          {GADGETS.map((g) => (
            <div key={g} className="flex items-center gap-2.5 text-sm text-gray-700">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {g}
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-3">
          {pricingPlans.map((plan) => {
            const planId = plan.id as PaidPlanId;
            const isLoading = loadingPlan === planId;
            return (
              <button
                key={plan.id}
                onClick={() => handleActivate(planId)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 text-sm font-bold rounded-2xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  plan.highlighted
                    ? 'text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:shadow-lg hover:shadow-blue-200 hover:scale-[1.01]'
                    : 'text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                {isLoading ? 'A preparar pagamento...' : `${plan.cta} — ${plan.price} / ${plan.period}`}
              </button>
            );
          })}
        </div>
        {checkoutError && <p className="text-xs text-red-500 text-center mb-3">{checkoutError}</p>}
        <button
          onClick={onClose}
          className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Continuar grátis
        </button>
      </div>
    </div>
  );
}
