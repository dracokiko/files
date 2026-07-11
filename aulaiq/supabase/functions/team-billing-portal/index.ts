// Supabase Edge Function — creates a Stripe Billing Portal session for the
// Team plan's admin. Deploy: supabase functions deploy team-billing-portal
//
// Secrets needed (same as create-checkout/stripe-webhook):
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Never trusts a customer id supplied by the client — it's always looked up
// server-side from the `teams` row owned by the authenticated user, and only
// if that user is the team's admin (owner_id = user.id).

import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonError('Não autenticado.', 401);
    }

    const { returnUrl } = await req.json().catch(() => ({ returnUrl: undefined })) as { returnUrl?: string };

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id, stripe_customer_id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (teamError) {
      return jsonError(teamError.message, 500);
    }
    if (!team) {
      // Either the user has no team, or they're a member (not the admin) —
      // either way they are not entitled to the billing portal.
      return jsonError('TEAM_ADMIN_REQUIRED', 403);
    }
    if (!team.stripe_customer_id) {
      return jsonError('NO_STRIPE_CUSTOMER', 409);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: team.stripe_customer_id,
      return_url: returnUrl || `${req.headers.get('origin') ?? 'https://keposlearn.com'}/dashboard/team`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return jsonError(message, 500);
  }
});
