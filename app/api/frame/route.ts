import { getPersona } from "@/lib/personas";
import { hasPass } from "@/lib/pass";
import { frameKey, rageKv, type Framed } from "@/lib/frames";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Framing is the one place Rage Typing keeps anything, so it is deliberately
 * opt-in, pass-only, and stores just the generated line — never what was typed.
 */
export async function POST(request: Request) {
  if (!(await hasPass(request, serverEnv("RAGE_PASS_SECRET")))) {
    return Response.json(
      { error: "Framing a burn needs a Rage Pass.", needsPass: true },
      { status: 402 }
    );
  }

  const store = rageKv();
  if (!store) {
    return Response.json({ error: "Framing is unavailable right now." }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const line = typeof body?.line === "string" ? body.line.slice(0, 500).trim() : "";
  if (!line) return Response.json({ error: "Nothing to frame." }, { status: 400 });

  const framed: Framed = {
    line,
    persona: getPersona(body?.persona).id,
    rage: Math.min(5, Math.max(0, Number(body?.rage) || 0)),
    kps: Math.min(99, Math.max(0, Number(body?.kps) || 0)),
    seconds: Math.min(999, Math.max(0, Number(body?.seconds) || 0)),
    at: new Date().toISOString(),
  };

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await store.put(frameKey(id), JSON.stringify(framed));

  return Response.json({ id });
}
