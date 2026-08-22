import Anthropic from "@anthropic-ai/sdk";
import { getOptionalRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "nodejs";

type Persona = "therapist" | "sarcastic";

const WINDOW_MS = 60_000;
const MAX_BURNS = 12;

type Bucket = { count: number; resetAt: number };

const memBuckets: { store: Map<string, Bucket> } =
  (globalThis as any).__rageRateBuckets ??
  ((globalThis as any).__rageRateBuckets = { store: new Map() });

function memLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = memBuckets.store.get(ip);
  if (!bucket || now > bucket.resetAt) {
    memBuckets.store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (bucket.count >= MAX_BURNS) return true;
  bucket.count += 1;
  return false;
}

async function kvLimited(kv: any, ip: string): Promise<boolean> {
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
    await kv.put(
      key,
      JSON.stringify({ count: 1, resetAt: now + WINDOW_MS }),
      { expirationTtl: Math.ceil(WINDOW_MS / 1000) + 5 }
    );
    return false;
  }
  if (bucket.count >= MAX_BURNS) return true;
  bucket.count += 1;
  await kv.put(key, JSON.stringify(bucket), {
    expirationTtl: Math.max(60, Math.ceil((bucket.resetAt - now) / 1000) + 5),
  });
  return false;
}

async function rateLimited(ip: string): Promise<boolean> {
  let ctx: any = null;
  try {
    ctx = getOptionalRequestContext();
  } catch {
    /* not on Cloudflare */
  }
  const kv = ctx?.env?.RAGE_KV;
  if (kv) return kvLimited(kv, ip);
  return memLimited(ip);
}

const SYSTEM = `You are the "burn" engine for Rage Typing, an app where people vent angry, heated, or toxic messages that self-destruct.
Given a user's message, reply with EXACTLY ONE brutally honest sentence.
The sentence's tone is set by the persona:
- therapist: calm, empathetic, insightful. Help them notice the real feeling beneath the anger without coddling.
- sarcastic: a hilarious, mocking mirror of how absurd, petty, or over-the-top they sound.
Hard rules:
- Output only the single sentence. No preamble, no markdown, no quotation marks, no bullets.
- Under 30 words.
- If the message is empty, harmless, or not actually angry, still return one fitting sentence (gentle for therapist, witty for sarcastic).`;

function isPersona(value: unknown): value is Persona {
  return value === "therapist" || value === "sarcastic";
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  if (await rateLimited(ip)) {
    return Response.json(
      { error: "Too many burns. Take a breath and try again in a minute." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
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

  const text = typeof (body as any)?.text === "string" ? (body as any).text : "";
  const persona = isPersona((body as any)?.persona) ? (body as any).persona : "sarcastic";

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
      max_tokens: 120,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Persona: ${persona}\n\nMessage:\n${text || "(nothing typed)"}`,
        },
      ],
    });

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return Response.json({ line: content });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to generate burn response." },
      { status: 502 }
    );
  }
}
