import type { Metadata } from "next";
import Link from "next/link";
import { b64encode } from "@/lib/codec";
import { getPersona } from "@/lib/personas";
import { RAGE_NAMES } from "@/lib/rage";
import { loadFrame } from "@/lib/frames";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const framed = await loadFrame((await params).id);
  if (!framed) return { title: "Burn Receipt | Rage Typing", robots: { index: false } };

  const title = `${RAGE_NAMES[framed.rage].toUpperCase()}: a framed burn`;
  const og = `/api/og?l=${encodeURIComponent(b64encode(framed.line))}&p=${framed.persona}&r=${framed.rage}`;

  return {
    title,
    description: framed.line,
    robots: { index: false },
    openGraph: { title, description: framed.line, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description: framed.line, images: [og] },
  };
}

export default async function FramedReceipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const framed = await loadFrame((await params).id);

  if (!framed) {
    return (
      <main className="stage">
        <section className="receipt show">
          <span className="receipt-tag">not found</span>
          <p className="receipt-line">There is no burn framed here.</p>
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
      data-rage={framed.rage}
      style={{ "--heat": framed.rage / 5 } as React.CSSProperties}
    >
      <div className="embers" aria-hidden="true" />
      <section className="receipt show framed-receipt">
        <span className="receipt-tag">
          {getPersona(framed.persona).tag} &middot; framed
        </span>
        <p className="receipt-line">{framed.line}</p>
        <dl className="stats">
          <div>
            <dt>peak</dt>
            <dd>{RAGE_NAMES[framed.rage]}</dd>
          </div>
          <div>
            <dt>top speed</dt>
            <dd>{framed.kps} keys/sec</dd>
          </div>
          <div>
            <dt>time to peak</dt>
            <dd>{framed.seconds.toFixed(1)}s</dd>
          </div>
        </dl>
        <Link className="copy" href="/">
          Type your own rage
        </Link>
      </section>
      <footer className="foot">
        <span>Framed on {new Date(framed.at).toISOString().slice(0, 10)}. This one does not burn.</span>
      </footer>
    </main>
  );
}
