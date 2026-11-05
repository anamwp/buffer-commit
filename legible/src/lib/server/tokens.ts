import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { ReauthRequiredError } from "../buffer/errors";
import { decrypt, encrypt } from "./crypto";
import { refreshTokens, type TokenResponse } from "./oauth";

const EXPIRY_MARGIN_MS = 60_000;
const LEASE_MS = 30_000;

export async function saveTokens(userId: string, tokens: TokenResponse) {
  const db = await getDb();
  const values = {
    userId,
    accessTokenEnc: encrypt(tokens.access_token),
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    // Store the moment it expires, minus a margin, not the duration.
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
    needsReauth: false,
    refreshLeaseUntil: null,
    updatedAt: new Date(),
  };
  await db.insert(schema.connections).values(values).onConflictDoUpdate({ target: schema.connections.userId, set: values });
}

/**
 * Return a valid access token, refreshing if needed. Buffer refresh tokens are
 * single-use and rotating: replaying a spent one revokes the whole grant. So
 * only the request holding a short DB lease refreshes; the others wait for it.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const db = await getDb();
  for (let attempt = 0; attempt < 20; attempt++) {
    const [conn] = await db.select().from(schema.connections).where(eq(schema.connections.userId, userId));
    if (!conn || conn.needsReauth) throw new ReauthRequiredError();
    if (conn.expiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()) return decrypt(conn.accessTokenEnc);
    if (!conn.refreshTokenEnc) throw new ReauthRequiredError();

    const leased = await db
      .update(schema.connections)
      .set({ refreshLeaseUntil: new Date(Date.now() + LEASE_MS) })
      .where(
        and(
          eq(schema.connections.userId, userId),
          or(isNull(schema.connections.refreshLeaseUntil), lt(schema.connections.refreshLeaseUntil, sql`now()`)),
        ),
      )
      .returning({ refreshTokenEnc: schema.connections.refreshTokenEnc });

    if (leased.length === 0) {
      // Someone else is refreshing. Wait, then re-read.
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    try {
      const tokens = await refreshTokens(decrypt(leased[0].refreshTokenEnc!));
      await saveTokens(userId, tokens);
      return tokens.access_token;
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        await db
          .update(schema.connections)
          .set({ needsReauth: true, refreshLeaseUntil: null })
          .where(eq(schema.connections.userId, userId));
      } else {
        // Transient failure: release the lease. Never retry with the same token
        // here; the next request re-reads whatever is stored.
        await db.update(schema.connections).set({ refreshLeaseUntil: null }).where(eq(schema.connections.userId, userId));
      }
      throw err;
    }
  }
  throw new Error("Timed out waiting for a token refresh");
}

export async function markNeedsReauth(userId: string) {
  const db = await getDb();
  await db.update(schema.connections).set({ needsReauth: true }).where(eq(schema.connections.userId, userId));
}
