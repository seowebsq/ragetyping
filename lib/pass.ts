// Rage Pass = an HMAC-signed cookie. No accounts, no database: the cookie itself
// is the proof of purchase, and the signature is what makes it unforgeable.

export const PASS_COOKIE = "ragepass";
export const PASS_DAYS = 365;

export type PassClaims = { sid: string; exp: number };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)), (c) =>
    c.charCodeAt(0)
  );
}

function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signPass(secret: string, claims: PassClaims): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyPass(
  secret: string,
  token: string | undefined
): Promise<PassClaims | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      unb64url(sig) as BufferSource,
      enc.encode(body)
    );
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(unb64url(body))) as PassClaims;
    if (typeof claims?.exp !== "number" || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Reads the pass cookie off a request and tells you whether it is currently valid. */
export async function hasPass(request: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const token = (request.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${PASS_COOKIE}=`))
    ?.slice(PASS_COOKIE.length + 1);
  return (await verifyPass(secret, token)) !== null;
}
