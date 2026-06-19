// Supabase Edge Function — cria uma Stripe Checkout Session
// Deploy: supabase functions deploy create-checkout
//
// Secrets necessários (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY        — sk_test_... ou sk_live_...
//   STRIPE_PRICE_TRIAL       — price_xxx  (Plano Teste 6€, one-time)
//   STRIPE_PRICE_MONTHLY     — price_xxx  (Plano Mensal 14.99€, recurring)
//   STRIPE_PRICE_SEMESTER    — price_xxx  (Plano Semestre 49.99€, one-time)
//   SUPABASE_SERVICE_ROLE_KEY — eyJ...

import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_IDS: Record<string, string> = {
  essential: Deno.env.get('STRIPE_PRICE_ESSENTIAL') ?? '',
  team:      Deno.env.get('STRIPE_PRICE_TEAM') ?? '',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    // Verificar utilizador via JWT
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { planId, successUrl, cancelUrl } = await req.json() as {
      planId: 'trial' | 'monthly' | 'semester';
      successUrl: string;
      cancelUrl: string;
    };

    const priceId = PRICE_IDS[planId];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Plano inválido.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Buscar ou criar customer Stripe
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, email, name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email!,
        name: profile?.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Criar Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: user.id, plan: planId },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
