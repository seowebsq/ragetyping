import { ImageResponse } from "next/og";
import { b64decode } from "@/lib/codec";
import { getPersona } from "@/lib/personas";
import { RAGE_NAMES } from "@/lib/rage";

export const runtime = "nodejs";

const HEAT = ["#4bd07f", "#b7d34a", "#ffb020", "#ff7a2c", "#ff4713", "#ff1f4b"];

// Satori needs an explicit display on every element with more than one child,
// so each row below is a flex container and every label is a single string.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  let line = "";
  try {
    const raw = params.get("l");
    if (raw && raw.length <= 2000) line = b64decode(raw).slice(0, 240);
  } catch {
    line = "";
  }

  const persona = getPersona(params.get("p"));
  const rage = Math.min(5, Math.max(0, Number(params.get("r")) || 0));
  const accent = HEAT[rage];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#0a0a0c",
          backgroundImage: `radial-gradient(120% 80% at 50% 110%, ${accent}55, transparent 70%)`,
          color: "#f4f1ec",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
          <div style={{ display: "flex", color: "#ff5a2c" }}>RAGE</div>
          <div style={{ display: "flex", color: "#f4f1ec" }}>TYPING</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: line.length > 120 ? 42 : 54,
            lineHeight: 1.25,
            fontWeight: 600,
          }}
        >
          {line || "This receipt has turned to ash."}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {RAGE_NAMES.map((name, i) => (
              <div
                key={name}
                style={{
                  width: 168,
                  height: 12,
                  borderRadius: 4,
                  background: i <= rage ? HEAT[i] : "#202027",
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 3,
              color: accent,
            }}
          >
            {`${RAGE_NAMES[rage].toUpperCase()} — ${persona.tag.toUpperCase()}`}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
