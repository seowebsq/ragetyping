"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { b64encode } from "@/lib/codec";
import { PERSONAS, DEFAULT_PERSONA, type PersonaId } from "@/lib/personas";
import { promptOfTheDay } from "@/lib/prompts";
import { RAGE_KPS, RAGE_NAMES, rageLevel } from "@/lib/rage";

type Status = "composing" | "burning" | "empty";

const IDLE_BURN_MS = 2600;
const SELF_DESTRUCT_MS = 9000;

const PASS_URL = process.env.NEXT_PUBLIC_RAGE_PASS_URL || "";
const TIP_URL = process.env.NEXT_PUBLIC_TIP_URL || "";

const PASS_NOTES: Record<string, string> = {
  ok: "Rage Pass active. Every persona is yours.",
  unpaid: "That checkout never completed, so no pass was issued.",
  invalid: "That activation link was malformed.",
  unconfigured: "Rage Pass is not configured on this server yet.",
};

type Stats = { rage: number; kps: number; seconds: number };

export default function Home() {
  const [text, setText] = useState("");
  const [persona, setPersona] = useState<PersonaId>(DEFAULT_PERSONA);
  const [status, setStatus] = useState<Status>("empty");
  const [line, setLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rage, setRage] = useState(0);
  const [pass, setPass] = useState(false);
  const [meltdowns, setMeltdowns] = useState<number | null>(null);
  const [daily, setDaily] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [framedUrl, setFramedUrl] = useState<string | null>(null);
  const [framing, setFraming] = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destructTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const burningRef = useRef(false);
  const textRef = useRef("");
  const keyTimes = useRef<number[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);

  // Peak stats for the current compose, reset on every fresh burn.
  const peak = useRef({ rage: 0, kps: 0, startedAt: 0, peakAt: 0 });

  useEffect(() => {
    setDaily(promptOfTheDay());
    const flag = new URLSearchParams(window.location.search).get("pass");
    if (flag && PASS_NOTES[flag]) {
      setNotice(PASS_NOTES[flag]);
      window.history.replaceState(null, "", window.location.pathname);
    }
    fetch("/api/burn")
      .then((r) => r.json())
      .then((d) => {
        setPass(Boolean(d?.pass));
        if (typeof d?.meltdowns === "number") setMeltdowns(d.meltdowns);
      })
      .catch(() => {
        /* counters are decorative */
      });
  }, []);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx.current) audioCtx.current = new Ctx();
    if (audioCtx.current.state === "suspended") void audioCtx.current.resume();
    return audioCtx.current;
  }, []);

  // Rage decays on its own, so the meter falls back to calm when the typing stops.
  const sampleRage = useCallback(() => {
    const cutoff = Date.now() - 1000;
    keyTimes.current = keyTimes.current.filter((t) => t > cutoff);
    const level = rageLevel(keyTimes.current.length);
    setRage(level);
    return level;
  }, []);

  const bumpRage = useCallback(() => {
    const now = Date.now();
    keyTimes.current.push(now);
    if (!peak.current.startedAt) peak.current.startedAt = now;
    const level = sampleRage();
    const kps = keyTimes.current.length;
    if (kps > peak.current.kps) peak.current.kps = kps;
    if (level >= peak.current.rage) {
      peak.current.rage = level;
      peak.current.peakAt = now;
    }
    if (!rageTimer.current) {
      rageTimer.current = setInterval(() => {
        if (sampleRage() === 0 && rageTimer.current) {
          clearInterval(rageTimer.current);
          rageTimer.current = null;
        }
      }, 120);
    }
    return level;
  }, [sampleRage]);

  const playTick = useCallback(
    (level: number) => {
      if (!soundOn) return;
      const ctx = ensureCtx();
      if (!ctx) return;

      const heat = level / (RAGE_KPS.length - 1);
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const peakGain = 0.035 + heat * 0.075;
      const decay = 0.06 / (1 + heat);
      osc.type = "triangle";
      osc.frequency.setValueAtTime((170 + Math.random() * 140) * (1 + heat), now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + decay + 0.01);
    },
    [soundOn, ensureCtx]
  );

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
    if (rageTimer.current) clearInterval(rageTimer.current);
    rageTimer.current = null;
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
      setFramedUrl(null);
      playBurn();

      const snapshot: Stats = {
        rage: peak.current.rage,
        kps: peak.current.kps,
        seconds: peak.current.startedAt
          ? Math.max(0, peak.current.peakAt - peak.current.startedAt) / 1000
          : 0,
      };

      try {
        const res = await fetch("/api/burn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, persona, rage: snapshot.rage }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Burn failed.");
        setLine(data.line);
        setStats(snapshot);
        if (typeof data?.meltdowns === "number") setMeltdowns(data.meltdowns);
        if (typeof data?.pass === "boolean") setPass(data.pass);

        const q = new URLSearchParams({
          l: b64encode(data.line),
          p: persona,
          r: String(snapshot.rage),
          k: String(snapshot.kps),
          s: snapshot.seconds.toFixed(1),
        });
        setShareUrl(`${window.location.origin}/receipt?${q.toString()}`);
        setCopied(false);

        setText("");
        textRef.current = "";
        peak.current = { rage: 0, kps: 0, startedAt: 0, peakAt: 0 };
        setStatus("empty");
        destructTimer.current = setTimeout(() => {
          setLine(null);
          setShareUrl(null);
          setStats(null);
          setFramedUrl(null);
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
    setFramedUrl(null);
    if (destructTimer.current) clearTimeout(destructTimer.current);
    playTick(bumpRage());
    if (value.trim()) armIdle();
    else if (idleTimer.current) clearTimeout(idleTimer.current);
  };

  const handleBurnClick = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    burn(text);
  };

  const pickPersona = (id: PersonaId, premium: boolean) => {
    if (premium && !pass) {
      setNotice(
        PASS_URL ? "That one is behind the Rage Pass." : "Rage Pass personas are not on sale yet."
      );
      return;
    }
    setNotice(null);
    setPersona(id);
  };

  const copyLink = async () => {
    const url = framedUrl || shareUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const frameBurn = async () => {
    if (!line || !stats || framing) return;
    setFraming(true);
    try {
      const res = await fetch("/api/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line, persona, ...stats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not frame that burn.");
      setFramedUrl(`${window.location.origin}/r/${data.id}`);
      if (destructTimer.current) clearTimeout(destructTimer.current);
    } catch (e: any) {
      setError(e?.message || "Could not frame that burn.");
    } finally {
      setFraming(false);
    }
  };

  useEffect(() => () => clearTimers(), [clearTimers]);

  const activeTag = PERSONAS.find((p) => p.id === persona)?.tag;

  return (
    <main
      className="stage"
      data-rage={rage}
      style={{ "--heat": rage / (RAGE_KPS.length - 1) } as React.CSSProperties}
    >
      <div className="embers" aria-hidden="true" />
      <header className="head">
        <h1 className="logo">
          RAGE<span>TYPING</span>
        </h1>
        <p className="tag">
          Type it. Stop. It burns. One brutally honest sentence is all that&apos;s left.
        </p>
        <p className="daily">
          {daily ? (
            <>
              Today&apos;s rage: <strong>{daily}</strong>
            </>
          ) : (
            <>&nbsp;</>
          )}
        </p>
      </header>

      <div className="persona" role="group" aria-label="Burn persona">
        {PERSONAS.map((p) => {
          const locked = p.premium && !pass;
          return (
            <button
              key={p.id}
              className={`pill${persona === p.id ? " active" : ""}${locked ? " locked" : ""}`}
              onClick={() => pickPersona(p.id, p.premium)}
              aria-pressed={persona === p.id}
            >
              {p.label}
              {locked && (
                <span className="lock" aria-label="Rage Pass only">
                  {" "}
                  &middot; pass
                </span>
              )}
            </button>
          );
        })}
      </div>

      {notice && (
        <p className="notice">
          {notice}
          {!pass && PASS_URL && (
            <a className="pass-link" href={PASS_URL}>
              Get the Rage Pass
            </a>
          )}
        </p>
      )}

      <div className="editor">
        <div
          className="meter"
          role="progressbar"
          aria-label="Rage level"
          aria-valuemin={0}
          aria-valuemax={RAGE_NAMES.length - 1}
          aria-valuenow={rage}
          aria-valuetext={RAGE_NAMES[rage]}
        >
          <div className="segs">
            {RAGE_NAMES.map((name, i) => (
              <span key={name} className={i <= rage ? "seg lit" : "seg"} />
            ))}
          </div>
          <span className="meter-name">{RAGE_NAMES[rage]}</span>
        </div>
        <textarea
          className="rage"
          placeholder="Say what you really feel. The second you pause, it&apos;s gone…"
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
            <span className="receipt-tag">{activeTag}</span>
            <p className="receipt-line">{line}</p>
            {stats && (
              <dl className="stats">
                <div>
                  <dt>peak</dt>
                  <dd>{RAGE_NAMES[stats.rage]}</dd>
                </div>
                <div>
                  <dt>top speed</dt>
                  <dd>{stats.kps} keys/sec</dd>
                </div>
                <div>
                  <dt>time to peak</dt>
                  <dd>{stats.seconds.toFixed(1)}s</dd>
                </div>
              </dl>
            )}
            <div className="share">
              <button className="copy" onClick={copyLink}>
                {copied ? "Link copied" : framedUrl ? "Copy framed link" : "Copy receipt link"}
              </button>
              {pass && !framedUrl && (
                <button className="copy ghost" onClick={frameBurn} disabled={framing}>
                  {framing ? "Framing…" : "Frame this burn"}
                </button>
              )}
              {framedUrl && <span className="framed">Framed — this one is permanent.</span>}
            </div>
            {!framedUrl && <span className="receipt-fade">self-destructing…</span>}
          </>
        )}
      </section>

      <footer className="foot">
        <span>
          Your words are never stored. They vanish the instant they&apos;re read back to you.
        </span>
        <span className="foot-links">
          {meltdowns !== null && meltdowns > 0 && (
            <span className="counter">{meltdowns.toLocaleString()} meltdowns today</span>
          )}
          {TIP_URL && (
            <a href={TIP_URL} rel="noreferrer noopener" target="_blank">
              Buy the servers a coffee
            </a>
          )}
          {!pass && PASS_URL && <a href={PASS_URL}>Rage Pass</a>}
        </span>
      </footer>
    </main>
  );
}
