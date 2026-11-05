import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { bufferGraphQL } from "../buffer/graphql";
import { ReauthRequiredError } from "../buffer/errors";
import type { RateLimitWindow } from "../buffer/ratelimit";
import { env } from "./env";
import { getAccessToken, markNeedsReauth } from "./tokens";

async function recordBudget(windows: RateLimitWindow[]) {
  if (!windows.length) return;
  const db = await getDb();
  for (const w of windows) {
    const row = {
      windowSeconds: w.windowSeconds,
      quota: w.quota,
      remaining: w.remaining,
      resetsAt: new Date(Date.now() + w.resetSeconds * 1000),
      seenAt: new Date(),
    };
    await db
      .insert(schema.apiBudget)
      .values(row)
      .onConflictDoUpdate({ target: schema.apiBudget.windowSeconds, set: row });
  }
}

/** Run a Buffer GraphQL operation as the given user. */
export async function bufferRequest<T>(userId: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const accessToken = await getAccessToken(userId);
  try {
    const { data, rateLimits } = await bufferGraphQL<T>(query, variables, { apiUrl: env().BUFFER_API_URL, accessToken });
    await recordBudget(rateLimits);
    return data;
  } catch (err) {
    if (err instanceof ReauthRequiredError) await markNeedsReauth(userId);
    throw err;
  }
}

export interface Budget {
  windowSeconds: number;
  quota: number;
  remaining: number;
  resetsAt: Date;
}

/** The latest known rate-limit state; stale windows (already reset) are dropped. */
export async function getBudget(): Promise<Budget[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.apiBudget).where(sql`${schema.apiBudget.resetsAt} > now()`);
  return rows.sort((a, b) => a.windowSeconds - b.windowSeconds);
}

/** True when any window is under 10% remaining (the CLI's warning threshold). */
export function budgetLow(budget: Budget[]): boolean {
  return budget.some((b) => b.quota > 0 && b.remaining / b.quota < 0.1);
}
