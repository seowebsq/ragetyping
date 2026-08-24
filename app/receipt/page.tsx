import type { Metadata } from "next";
import Link from "next/link";
import { b64decode } from "@/lib/codec";
import { getPersona } from "@/lib/personas";
import { RAGE_NAMES } from "@/lib/rage";

type Params = { l?: string; p?: string; r?: string; k?: string; s?: string };

function decode(params: Params) {
  const raw = params.l;
  if (!raw || raw.length > 2000) return null;
  let line: string;
  try {
    line = b64decode(raw);
  } catch {
    return null;
  }
  if (!line || line.length > 500) return null;

  const rage = Math.min(5, Math.max(0, Number(params.r) || 0));
  const kps = Math.min(99, Math.max(0, Number(params.k) || 0));
  const seconds = Math.min(999, Math.max(0, Number(params.s) || 0));

  return { line, persona: getPersona(params.p), rage, kps, seconds };
}

function ogUrl(params: Params) {
  const q = new URLSearchParams();
  if (params.l) q.set("l", params.l);
  if (params.p) q.set("p", params.p);
  if (params.r) q.set("r", params.r);
  return `/api/og?${q.toString()}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const params = await searchParams;
  const receipt = decode(params);
  const title = receipt
    ? `${RAGE_NAMES[receipt.rage].toUpperCase()}: a burn receipt`
    : "Burn Receipt | Rage Typing";

  return {
    title,
    description: receipt?.line ?? "This receipt has turned to ash.",
    robots: { index: false },
    openGraph: {
      title,
      description: receipt?.line ?? "This receipt has turned to ash.",
      images: [{ url: ogUrl(params), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: receipt?.line ?? "This receipt has turned to ash.",
      images: [ogUrl(params)],
    },
  };
}

export default async function Receipt({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const receipt = decode(await searchParams);

  if (!receipt) {
    return (
      <main className="stage">
        <section className="receipt show">
          <span className="receipt-tag">burned out</span>
          <p className="receipt-line">This receipt has turned to ash.</p>
          <Link className="copy" href="/">
            Type your own rage
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main
      className="stage"
      data-rage={receipt.rage}
      style={{ "--heat": receipt.rage / 5 } as React.CSSProperties}
    >
      <div className="embers" aria-hidden="true" />
      <section className="receipt show" aria-live="polite">
        <span className="receipt-tag">{receipt.persona.tag}</span>
        <p className="receipt-line">{receipt.line}</p>
        <dl className="stats">
          <div>
            <dt>peak</dt>
            <dd>{RAGE_NAMES[receipt.rage]}</dd>
          </div>
          <div>
            <dt>top speed</dt>
            <dd>{receipt.kps} keys/sec</dd>
          </div>
          <div>
            <dt>time to peak</dt>
            <dd>{receipt.seconds.toFixed(1)}s</dd>
          </div>
        </dl>
        <Link className="copy" href="/">
          Type your own rage
        </Link>
      </section>
      <footer className="foot">A burn receipt from Rage Typing.</footer>
    </main>
  );
}
