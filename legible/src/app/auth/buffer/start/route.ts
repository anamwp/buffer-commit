import { NextResponse } from "next/server";
import { buildAuthorizeUrl, newOAuthState } from "@/lib/server/oauth";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const oauth = newOAuthState();
  // state + PKCE verifier live in the sealed cookie, never in memory, so the
  // callback works on any serverless instance.
  session.oauth = oauth;
  await session.save();
  return NextResponse.redirect(buildAuthorizeUrl(oauth.state, oauth.verifier));
}
