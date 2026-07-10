import type { PricingPlan } from '../types';

export const pricingPlans: PricingPlan[] = [
  {
    id: 'essential',
    name: 'Versão Essential',
    price: '5,99€',
    period: 'por mês',
    features: [
      '200 mensagens por dia',
      '1 curso à tua escolha',
      'Chatbot de estudo com IA',
      'Quizzes automáticos e XP',
      'Plano de estudo personalizado',
    ],
    cta: 'Começar Essential',
  },
  {
    id: 'team',
    name: 'Versão Team',
    price: '16,99€',
    period: 'por mês',
    features: [
      'Admin + 3 membros (4 no total)',
      '200 mensagens por dia por membro',
      'Quotas independentes por pessoa',
      'Todos os recursos do Essential',
      'Painel de gestão de equipa',
    ],
    cta: 'Começar Team',
    highlighted: true,
    badge: 'Melhor valor',
  },
];
