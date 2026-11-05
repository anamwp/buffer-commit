import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { bufferGraphQL } from "@/lib/buffer/graphql";
import { ACCOUNT_QUERY, type AccountData } from "@/lib/buffer/operations";
import { env } from "@/lib/server/env";
import { exchangeCode } from "@/lib/server/oauth";
import { getSession } from "@/lib/server/session";
import { saveTokens } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

const STATE_TTL_MS = 10 * 60_000;

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function fail(req: NextRequest, reason: string) {
  const url = new URL("/", req.nextUrl.origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const session = await getSession();
  const pending = session.oauth;
  delete session.oauth;
  await session.save();

  const state = params.get("state") ?? "";
  if (!pending || Date.now() - pending.createdAt > STATE_TTL_MS || !safeEqual(state, pending.state)) {
    return fail(req, "state");
  }
  if (params.get("error")) return fail(req, params.get("error") === "access_denied" ? "denied" : "oauth");
  const code = params.get("code");
  if (!code) return fail(req, "oauth");

  try {
    const tokens = await exchangeCode(code, pending.verifier);
    const { data } = await bufferGraphQL<AccountData>(ACCOUNT_QUERY, {}, {
      apiUrl: env().BUFFER_API_URL,
      accessToken: tokens.access_token,
    });
    const a = data.account;
    const db = await getDb();
    const profile = { email: a.email, name: a.name, timezone: a.timezone, organizations: a.organizations };
    const [user] = await db
      .insert(schema.users)
      .values({ bufferAccountId: a.id, ...profile })
      .onConflictDoUpdate({ target: schema.users.bufferAccountId, set: profile })
      .returning();
    await saveTokens(user.id, tokens);

    session.userId = user.id;
    session.orgId = a.organizations.length === 1 ? a.organizations[0].id : session.orgId;
    await session.save();
    return NextResponse.redirect(new URL("/app", req.nextUrl.origin));
  } catch (err) {
    console.error("OAuth callback failed", err instanceof Error ? err.message : err);
    return fail(req, "oauth");
  }
}
