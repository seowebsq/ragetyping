"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { b64encode } from "@/lib/codec";

type Persona = "therapist" | "sarcastic";
type Status = "composing" | "burning" | "empty";

const IDLE_BURN_MS = 2600;
const SELF_DESTRUCT_MS = 9000;

// Keystrokes-per-second thresholds per rage level, ported from RageType's curve.
const RAGE_KPS = [0, 4, 7, 11, 16, 22];

export default function Home() {
  const [text, setText] = useState("");
  const [persona, setPersona] = useState<Persona>("sarcastic");
  const [status, setStatus] = useState<Status>("empty");
  const [line, setLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destructTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burningRef = useRef(false);
  const textRef = useRef("");
  const keyTimes = useRef<number[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx.current) audioCtx.current = new Ctx();
    if (audioCtx.current.state === "suspended") void audioCtx.current.resume();
    return audioCtx.current;
  }, []);

  const playTick = useCallback(() => {
    if (!soundOn) return;
    const ctx = ensureCtx();
    if (!ctx) return;

    // ponytail: rage level = keystrokes in the last second, bucketed on RAGE_KPS.
    const stamp = Date.now();
    keyTimes.current = keyTimes.current.filter((t) => stamp - t < 1000).concat(stamp);
    const kps = keyTimes.current.length;
    const heat = RAGE_KPS.findLastIndex((t) => kps >= t) / (RAGE_KPS.length - 1);

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const peak = 0.035 + heat * 0.075;
    const decay = 0.06 / (1 + heat);
    osc.type = "triangle";
    osc.frequency.setValueAtTime((170 + Math.random() * 140) * (1 + heat), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + decay + 0.01);
  }, [soundOn, ensureCtx]);

  const playBurn = useCallback(() => {
    if (!soundOn) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const size = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.5);
  }, [soundOn, ensureCtx]);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (destructTimer.current) clearTimeout(destructTimer.current);
    idleTimer.current = null;
    destructTimer.current = null;
  }, []);

  const burn = useCallback(
    async (value: string) => {
      if (burningRef.current) return;
      burningRef.current = true;
      setStatus("burning");
      setError(null);
      setLine(null);
      playBurn();

      try {
        const res = await fetch("/api/burn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, persona }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Burn failed.");
        setLine(data.line);
        if (typeof window !== "undefined") {
          const url = `${window.location.origin}/receipt?l=${encodeURIComponent(
            b64encode(data.line)
          )}&p=${persona}`;
          setShareUrl(url);
          setCopied(false);
        }
        setText("");
        textRef.current = "";
        setStatus("empty");
        destructTimer.current = setTimeout(() => {
          setLine(null);
          setShareUrl(null);
          setStatus("empty");
        }, SELF_DESTRUCT_MS);
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
        setStatus(value.trim() ? "composing" : "empty");
      } finally {
        burningRef.current = false;
      }
    },
    [persona, playBurn]
  );

  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (textRef.current.trim()) burn(textRef.current);
    }, IDLE_BURN_MS);
  }, [burn]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    textRef.current = value;
    setError(null);
    setStatus(value.trim() ? "composing" : "empty");
    setLine(null);
    setShareUrl(null);
    if (destructTimer.current) clearTimeout(destructTimer.current);
    playTick();
    if (value.trim()) armIdle();
    else if (idleTimer.current) clearTimeout(idleTimer.current);
  };

  const handleBurnClick = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    burn(text);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <main className="stage">
      <header className="head">
        <h1 className="logo">
          RAGE<span>TYPING</span>
        </h1>
        <p className="tag">
          Type it. Stop. It burns. One brutally honest sentence is all that&apos;s left.
        </p>
      </header>

      <div className="persona" role="group" aria-label="Burn persona">
        <button
          className={persona === "sarcastic" ? "pill active" : "pill"}
          onClick={() => setPersona("sarcastic")}
        >
          Sarcastic mirror
        </button>
        <button
          className={persona === "therapist" ? "pill active" : "pill"}
          onClick={() => setPersona("therapist")}
        >
          Empathetic therapist
        </button>
      </div>

      <div className="editor">
        <textarea
          className="rage"
          placeholder="Say what you really feel. The second you pause, it's gone…"
          value={text}
          onChange={handleChange}
          spellCheck={false}
          aria-label="Your message"
        />
        <div className="controls">
          <div className="left">
            <button
              className={`sound ${soundOn ? "on" : ""}`}
              onClick={() => setSoundOn((s) => !s)}
              aria-pressed={soundOn}
            >
              {soundOn ? "Sound on" : "Sound off"}
            </button>
            <span className={`hint ${status === "composing" ? "live" : ""}`}>
              {status === "burning"
                ? "burning…"
                : status === "composing"
                  ? "idle — burning in a moment"
                  : "start typing"}
            </span>
          </div>
          <button className="burn" onClick={handleBurnClick} disabled={status === "burning"}>
            Burn it
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <section className={`receipt ${line ? "show" : ""}`} aria-live="polite">
        {line && (
          <>
            <span className="receipt-tag">
              {persona === "therapist" ? "therapist" : "mirror"}
            </span>
            <p className="receipt-line">{line}</p>
            {shareUrl && (
              <div className="share">
                <button className="copy" onClick={copyLink}>
                  {copied ? "Link copied" : "Copy receipt link"}
                </button>
              </div>
            )}
            <span className="receipt-fade">self-destructing…</span>
          </>
        )}
      </section>

      <footer className="foot">
        Your words are never stored. They vanish the instant they&apos;re read back to you.
      </footer>
    </main>
  );
}
