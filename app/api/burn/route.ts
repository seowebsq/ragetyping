import Anthropic from "@anthropic-ai/sdk";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PERSONAS, getPersona } from "@/lib/personas";
import { hasPass } from "@/lib/pass";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

// ponytail: env is only readable per-request on Workers, so read the limits at call time.
const limits = (pass: boolean) => ({
  windowMs: Number(serverEnv("BURN_WINDOW_MS")) || 60_000,
  maxBurns: pass
    ? Number(serverEnv("BURN_LIMIT_PASS")) || 60
    : Number(serverEnv("BURN_LIMIT")) || 12,
});

const MAX_TEXT = 2000;

type Bucket = { count: number; resetAt: number };

const memBuckets: { store: Map<string, Bucket> } =
  (globalThis as any).__rageRateBuckets ??
  ((globalThis as any).__rageRateBuckets = { store: new Map() });

function memLimited(ip: string, pass: boolean): boolean {
  const { windowMs, maxBurns } = limits(pass);
  const now = Date.now();
  const bucket = memBuckets.store.get(ip);
  if (!bucket || now > bucket.resetAt) {
    memBuckets.store.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (bucket.count >= maxBurns) return true;
  bucket.count += 1;
  return false;
}

async function kvLimited(kv: any, ip: string, pass: boolean): Promise<boolean> {
  const { windowMs, maxBurns } = limits(pass);
  const key = `rate:${ip}`;
  const now = Date.now();
  let bucket: Bucket | null = null;
  try {
    const raw = await kv.get(key);
    if (raw) bucket = JSON.parse(raw) as Bucket;
  } catch {
    /* ignore read errors, fall through to allow */
  }
  if (!bucket || now > bucket.resetAt) {
    await kv.put(key, JSON.stringify({ count: 1, resetAt: now + windowMs }), {
      expirationTtl: Math.ceil(windowMs / 1000) + 5,
    });
    return false;
  }
  if (bucket.count >= maxBurns) return true;
  bucket.count += 1;
  await kv.put(key, JSON.stringify(bucket), {
    expirationTtl: Math.max(60, Math.ceil((bucket.resetAt - now) / 1000) + 5),
  });
  return false;
}

function cfEnv(): any {
  try {
    return getCloudflareContext()?.env ?? null;
  } catch {
    return null;
  }
}

async function rateLimited(kv: any, ip: string, pass: boolean): Promise<boolean> {
  if (kv) return kvLimited(kv, ip, pass);
  return memLimited(ip, pass);
}

export function todayKey(now = new Date()): string {
  return `meltdowns:${now.toISOString().slice(0, 10)}`;
}

// ponytail: KV has no atomic increment, so a burst of simultaneous burns can lose a
// tick. It is a vanity counter, so swap in a Durable Object if it ever has to be exact.
async function countMeltdown(kv: any): Promise<number | null> {
  if (!kv) return null;
  const key = todayKey();
  try {
    const current = Number(await kv.get(key)) || 0;
    const next = current + 1;
    await kv.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 8 });
    return next;
  } catch {
    return null;
  }
}

const SYSTEM = `You are the "burn" engine for Rage Typing, an app where people vent angry, heated, or toxic messages that self-destruct.
Given a user's message, reply with EXACTLY ONE brutally honest sentence.
Hard rules:
- Output only the single sentence. No preamble, no markdown, no quotation marks, no bullets.
- Under 30 words.
- If the message is empty, harmless, or not actually angry, still return one fitting sentence in the same voice.`;

export async function POST(request: Request) {
  const env = cfEnv();
  const kv = env?.RAGE_KV;
  const pass = await hasPass(request, serverEnv("RAGE_PASS_SECRET"));

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  if (await rateLimited(kv, ip, pass)) {
    return Response.json(
      {
        error: pass
          ? "Even the pass has limits. Take a breath and try again in a minute."
          : "Too many burns. Take a breath, or grab a Rage Pass for a higher limit.",
      },
      { status: 429 }
    );
  }

  if (!serverEnv("ANTHROPIC_API_KEY")) {
    return Response.json(
      { error: "Server is not configured with ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (
    typeof (body as any)?.text === "string" ? (body as any).text : ""
  ).slice(0, MAX_TEXT);
  const persona = getPersona((body as any)?.persona);
  const rage = Math.min(5, Math.max(0, Number((body as any)?.rage) || 0));

  if (persona.premium && !pass) {
    return Response.json(
      { error: `${persona.label} is a Rage Pass persona.`, needsPass: true },
      { status: 402 }
    );
  }

  const client = new Anthropic({
    apiKey: serverEnv("ANTHROPIC_API_KEY"),
    fetch: (url, init) => fetch(url as any, init as any),
  });

  try {
    const message = await client.messages.create({
      model: serverEnv("ANTHROPIC_MODEL") || "claude-haiku-4-5",
      max_tokens: 120,
      system: `${SYSTEM}\n\nThe voice for this reply: ${persona.direction}.`,
      messages: [
        {
          role: "user",
          content: `Message:\n${text || "(nothing typed)"}`,
        },
      ],
    });

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const meltdowns = rage >= 5 ? await countMeltdown(kv) : null;

    return Response.json({
      line: content || "Nothing left to say. It's gone.",
      meltdowns,
      pass,
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to generate burn response." },
      { status: 502 }
    );
  }
}

export async function GET(request: Request) {
  const env = cfEnv();
  const kv = env?.RAGE_KV;
  let meltdowns = 0;
  try {
    if (kv) meltdowns = Number(await kv.get(todayKey())) || 0;
  } catch {
    /* counter is decorative, never fail the page for it */
  }
  return Response.json({
    meltdowns,
    pass: await hasPass(request, serverEnv("RAGE_PASS_SECRET")),
    personas: PERSONAS.map(({ id, label, premium }) => ({ id, label, premium })),
  });
}
