// Supabase Edge Function — recebe webhook do Stripe e atualiza o plano do utilizador
// Deploy: supabase functions deploy stripe-webhook
//
// Secrets necessários:
//   STRIPE_SECRET_KEY        — sk_test_... ou sk_live_...
//   STRIPE_WEBHOOK_SECRET    — whsec_... (obtém em stripe.com → Developers → Webhooks)
//   SUPABASE_SERVICE_ROLE_KEY — eyJ...
//
// No Stripe Dashboard, configura o webhook endpoint para:
//   https://kdrhuuupityblndayems.supabase.co/functions/v1/stripe-webhook
// Eventos a escutar: checkout.session.completed

import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch {
    return new Response('Webhook signature inválida.', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const plan = session.metadata?.plan;

    if (userId && plan) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      await supabase
        .from('profiles')
        .update({ plan })
        .eq('id', userId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
