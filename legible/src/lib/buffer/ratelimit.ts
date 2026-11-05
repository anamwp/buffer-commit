/**
 * Parse Buffer's structured rate-limit headers (see developers.buffer.com/guides/api-limits.html):
 *   RateLimit: "100-in-15min";r=98;t=897, "500-in-1day";r=498;t=86397
 *   RateLimit-Policy: "100-in-15min";q=100;w=900;pk=:...:, ...
 * fetch() joins repeated headers with ", ". Windows are matched by `w`, not by name.
 */
export interface RateLimitWindow {
  name: string;
  windowSeconds: number;
  quota: number;
  remaining: number;
  resetSeconds: number;
}

function split(header: string | null): string[] {
  if (!header) return [];
  return header.split(/,\s*(?=")/).map((s) => s.trim()).filter(Boolean);
}

function params(entry: string): { name: string; values: Record<string, string> } | null {
  const name = entry.match(/^"([^"]+)"/)?.[1];
  if (!name) return null;
  const values: Record<string, string> = {};
  for (const m of entry.matchAll(/;\s*([a-z]+)=([^;]+)/g)) values[m[1]] = m[2].trim();
  return { name, values };
}

export function parseRateLimit(rateLimit: string | null, policy: string | null): RateLimitWindow[] {
  const policies = new Map<string, { q: number; w: number }>();
  for (const entry of split(policy)) {
    const p = params(entry);
    if (p && p.values.q && p.values.w) policies.set(p.name, { q: Number(p.values.q), w: Number(p.values.w) });
  }
  const out: RateLimitWindow[] = [];
  for (const entry of split(rateLimit)) {
    const p = params(entry);
    if (!p || p.values.r === undefined) continue;
    const pol = policies.get(p.name);
    const w = pol?.w ?? inferWindow(p.name);
    if (!w) continue;
    out.push({
      name: p.name,
      windowSeconds: w,
      quota: pol?.q ?? Number(p.name.split("-")[0]) ?? 0,
      remaining: Number(p.values.r),
      resetSeconds: Number(p.values.t ?? 0),
    });
  }
  return out;
}

function inferWindow(name: string): number | null {
  if (name.endsWith("15min")) return 900;
  if (name.endsWith("1day")) return 86400;
  if (name.endsWith("30days")) return 2592000;
  return null;
}

export function windowLabel(seconds: number): string {
  if (seconds === 900) return "15 minutes";
  if (seconds === 86400) return "24 hours";
  if (seconds === 2592000) return "30 days";
  return `${seconds}s`;
}
