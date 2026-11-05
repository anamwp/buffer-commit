import "server-only";
import { codeChallenge, randomToken } from "../buffer/pkce";
import { BufferApiError, ReauthRequiredError } from "../buffer/errors";
import { env } from "./env";

/** Least privilege: read the queue, edit posts, leave Notes, stay connected. */
export const SCOPES = ["account:read", "posts:read", "posts:write", "notes:write", "offline_access"];

export function buildAuthorizeUrl(state: string, verifier: string): string {
  const e = env();
  const url = new URL("/auth", e.BUFFER_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: e.BUFFER_CLIENT_ID,
    redirect_uri: e.REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "consent",
  }).toString();
  return url.toString();
}

export function newOAuthState() {
  return { state: randomToken(), verifier: randomToken(48), createdAt: Date.now() };
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const e = env();
  const res = await fetch(new URL("/token", e.BUFFER_AUTH_URL), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.BUFFER_CLIENT_ID, client_secret: e.BUFFER_CLIENT_SECRET, ...body }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new ReauthRequiredError(json.error_description ?? "Grant is no longer valid");
    throw new BufferApiError(`Token endpoint error: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim());
  }
  return json as TokenResponse;
}

export function exchangeCode(code: string, verifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: env().REDIRECT_URI,
    code_verifier: verifier,
  });
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}
