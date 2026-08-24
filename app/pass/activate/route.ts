import { PASS_COOKIE, PASS_DAYS, signPass } from "@/lib/pass";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Stripe sends the buyer back here with ?session_id=... after a Payment Link
 * checkout. The id alone proves nothing, so it is verified against Stripe before
 * a pass cookie is minted.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") || "";
  const home = new URL("/", url.origin);

  const secret = serverEnv("RAGE_PASS_SECRET");
  const stripeKey = serverEnv("STRIPE_SECRET_KEY");
  if (!secret || !stripeKey) {
    home.searchParams.set("pass", "unconfigured");
    return Response.redirect(home, 303);
  }

  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    home.searchParams.set("pass", "invalid");
    return Response.redirect(home, 303);
  }

  let paid = false;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const session: any = await res.json();
    paid = res.ok && session?.payment_status === "paid";
  } catch {
    paid = false;
  }

  if (!paid) {
    home.searchParams.set("pass", "unpaid");
    return Response.redirect(home, 303);
  }

  const maxAge = PASS_DAYS * 24 * 60 * 60;
  const token = await signPass(secret, { sid: sessionId, exp: Date.now() + maxAge * 1000 });

  home.searchParams.set("pass", "ok");
  return new Response(null, {
    status: 303,
    headers: {
      Location: home.toString(),
      "Set-Cookie": `${PASS_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
