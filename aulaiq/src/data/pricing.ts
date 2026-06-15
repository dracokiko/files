import type { PricingPlan } from '../types';

export const pricingPlans: PricingPlan[] = [
  {
    id: 'trial',
    name: 'Plano Teste',
    price: '6€',
    period: '7 dias',
    features: [
      'Acesso ilimitado durante o período de teste',
      'Chatbot por cadeira',
      'Quizzes automáticos',
      'Plano de estudo gerado',
      'Ideal para experimentar antes de exames',
    ],
    cta: 'Testar por 7 dias',
  },
  {
    id: 'monthly',
    name: 'Plano Mensal',
    price: '14,99€',
    period: 'por mês',
    features: [
      'Chatbot por cadeira',
      'Quizzes ilimitados',
      'Plano de estudo personalizado',
      'Materiais organizados',
      'Suporte prioritário',
    ],
    cta: 'Começar mensal',
  },
  {
    id: 'semester',
    name: 'Plano Semestre',
    price: '49,99€',
    period: 'por semestre',
    features: [
      'Tudo do plano mensal',
      'Preparação para frequências e exames',
      'Prioridade em novas cadeiras',
      'Acesso a correções de professores',
      'Relatório de progresso semanal',
    ],
    cta: 'Escolher semestre',
    highlighted: true,
    badge: 'Melhor valor',
  },
];
