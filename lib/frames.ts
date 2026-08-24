import { getCloudflareContext } from "@opennextjs/cloudflare";

export type Framed = {
  line: string;
  persona: string;
  rage: number;
  kps: number;
  seconds: number;
  at: string;
};

export const frameKey = (id: string) => `frame:${id}`;

export function rageKv(): any {
  try {
    return (getCloudflareContext()?.env as any)?.RAGE_KV ?? null;
  } catch {
    return null;
  }
}

export async function loadFrame(id: string): Promise<Framed | null> {
  if (!/^[a-f0-9]{6,32}$/.test(id)) return null;
  try {
    const raw = await rageKv()?.get(frameKey(id));
    return raw ? (JSON.parse(raw) as Framed) : null;
  } catch {
    return null;
  }
}
