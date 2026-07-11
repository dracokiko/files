import { supabase } from '../lib/supabase';

export type PaidPlanId = 'essential' | 'team';

// Payment Link fallback used only if the create-checkout Edge Function call
// fails — there's no dedicated link for 'team' yet, so that plan has no
// fallback and simply reports unavailable if the Edge Function is down.
const FALLBACK_LINKS: Partial<Record<PaidPlanId, string | undefined>> = {
  essential: import.meta.env.VITE_STRIPE_LINK_MONTHLY,
};

export async function startCheckout(planId: PaidPlanId): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        planId,
        successUrl: `${window.location.origin}/?payment=success`,
        cancelUrl: `${window.location.origin}/`,
      },
    });

    if (!error && data?.url) {
      window.location.href = data.url;
      return { error: null };
    }
  } catch {
    // fall through to Payment Link fallback
  }

  const fallback = FALLBACK_LINKS[planId];
  if (fallback && !fallback.includes('SUBSTITUI')) {
    window.location.href = fallback;
    return { error: null };
  }

  return { error: 'Pagamento temporariamente indisponível. Contacta o suporte.' };
}
