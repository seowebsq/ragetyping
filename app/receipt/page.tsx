import Link from "next/link";
import { b64decode } from "@/lib/codec";

export const metadata = {
  title: "Burn Receipt — Rage Typing",
  robots: { index: false },
};

function decode(l: string | undefined, p: string | undefined) {
  if (!l) return null;
  if (l.length > 2000) return null;
  let line: string;
  try {
    line = b64decode(l);
  } catch {
    return null;
  }
  if (line.length > 500) return null;
  const persona = p === "therapist" ? "therapist" : "sarcastic";
  return { line, persona };
}

export default async function Receipt({
  searchParams,
}: {
  searchParams: Promise<{ l?: string; p?: string }>;
}) {
  const params = await searchParams;
  const receipt = decode(params.l, params.p);

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
    <main className="stage">
      <section className="receipt show" aria-live="polite">
        <span className="receipt-tag">
          {receipt.persona === "therapist" ? "therapist" : "mirror"}
        </span>
        <p className="receipt-line">{receipt.line}</p>
        <Link className="copy" href="/">
          Type your own rage
        </Link>
      </section>
      <footer className="foot">A burn receipt from Rage Typing.</footer>
    </main>
  );
}
