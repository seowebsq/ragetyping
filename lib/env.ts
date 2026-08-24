import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Reads a server-side value from whichever place it actually lives:
 * wrangler vars and secrets arrive on the Cloudflare context, while `.env.local`
 * and `next dev` put things on process.env. Checking both means the same code
 * works deployed and locally without a second set of instructions.
 */
export function serverEnv(name: string): string | undefined {
  try {
    const value = (getCloudflareContext()?.env as any)?.[name];
    if (typeof value === "string" && value) return value;
  } catch {
    /* not running on Cloudflare */
  }
  return process.env[name] || undefined;
}
