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
// Eventos a escutar: checkout.session.completed, customer.subscription.updated,
//                    customer.subscription.deleted
//
// Team seat limit: kept in sync by hand in three places — this constant,
// backend/config/team.js, and aulaiq/src/config/team.ts. The database
// (teams.seats_total) is the actual authority once a team row exists.
const TEAM_MAX_SEATS = 5;

import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const plan = session.metadata?.plan;
  if (!userId || !plan) return;

  const supabase = supabaseAdmin();
  await supabase.from('profiles').update({ plan }).eq('id', userId);

  if (plan !== 'team') return;

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!customerId || !subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Idempotent: this handler can run more than once for the same checkout
  // (Stripe retries on non-2xx, and webhooks aren't guaranteed exactly-once).
  const { data: existingTeam } = await supabase
    .from('teams').select('id').eq('owner_id', userId).maybeSingle();

  if (existingTeam) {
    await supabase.from('teams').update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }).eq('id', existingTeam.id);
    return;
  }

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).single();
  const { data: newTeam, error: teamError } = await supabase.from('teams').insert({
    name: profile?.name ? `Equipa de ${profile.name.split(' ')[0]}` : 'A minha equipa',
    owner_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    seats_total: TEAM_MAX_SEATS,
  }).select('id').single();

  if (teamError || !newTeam) {
    console.error('Falha ao criar equipa:', teamError?.message);
    return;
  }

  // The purchaser is the team's admin — insert their membership row too.
  // Ignore a unique-violation (already an active member of some team),
  // which would indicate a retry or a pre-existing membership; the team row
  // itself was already created/updated above either way.
  const { error: memberError } = await supabase.from('team_members').insert({
    team_id: newTeam.id, user_id: userId, role: 'admin', status: 'active',
  });
  if (memberError) console.error('Falha ao criar membership de admin:', memberError.message);
}

async function handleSubscriptionSync(subscription: Stripe.Subscription) {
  const supabase = supabaseAdmin();
  await supabase.from('teams').update({
    subscription_status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  }).eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = supabaseAdmin();
  const { data: team } = await supabase
    .from('teams')
    .update({ subscription_status: 'canceled', cancel_at_period_end: false })
    .eq('stripe_subscription_id', subscription.id)
    .select('id')
    .maybeSingle();
  if (!team) return;

  // The team's academic-feature entitlement (profiles.plan) is granted per
  // member at accept time (see team_accept_invitation in the migration) —
  // nobody separately paid for it, so once the subscription is truly gone,
  // every active member (admin included) loses it. Membership rows stay
  // intact so re-subscribing doesn't require re-inviting everyone.
  const { data: members } = await supabase
    .from('team_members').select('user_id').eq('team_id', team.id).eq('status', 'active');
  if (members?.length) {
    await supabase.from('profiles').update({ plan: 'free' }).in('id', members.map((m) => m.user_id));
  }
}

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

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionSync(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    console.error('Erro a processar webhook:', err instanceof Error ? err.message : err);
    // Still 200 — Stripe would otherwise retry an event we already partly
    // applied, and errors are logged for manual follow-up.
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
