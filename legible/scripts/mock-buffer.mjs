// A small stand-in for auth.buffer.com and api.buffer.com, for local
// development, demos and end-to-end tests without spending real API quota.
// It enforces PKCE (S256), state round-trip, single-use rotating refresh
// tokens, and returns the same RateLimit headers the real API sends.
//
//   node scripts/mock-buffer.mjs            # listens on :4010
//   BUFFER_API_URL=http://localhost:4010/graphql BUFFER_AUTH_URL=http://localhost:4010 pnpm dev
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const codes = new Map(); // code -> { challenge, redirectUri }
const accessTokens = new Set();
const refreshTokens = new Set();
let remaining15 = 100;
export const log = [];

const ORG = "64f0c0ffee0000000000000a";
const CH = { li: "64f0c0ffee0000000000000b", ig: "64f0c0ffee0000000000000c", x: "64f0c0ffee0000000000000d" };
const inDays = (d) => new Date(Date.now() + d * 86_400_000).toISOString();
const img = (n, altText) => ({
  __typename: "ImageAsset", type: "image",
  source: `https://picsum.photos/seed/legible${n}/800/600`, thumbnail: `https://picsum.photos/seed/legible${n}/200/150`,
  image: { altText, userTags: n === 2 ? [{ handle: "legible", x: 0.4, y: 0.6 }] : null },
});
const posts = new Map(
  [
    { id: "6500000000000000000000a1", text: "🚀🚀🚀 𝐁𝐢𝐠 𝐧𝐞𝐰𝐬: our accessibility course is LIVE TODAY ONLY!!! 🔥🔥🔥\n\nSign up now #smallbusinessowner #socialmediatips", status: "scheduled", dueAt: inDays(1), channelId: CH.li, channelService: "linkedin", metadata: { __typename: "LinkedInPostMetadata" }, assets: [img(1, "")] },
    { id: "6500000000000000000000a2", text: "Behind the scenes at the studio today 📸", status: "scheduled", dueAt: inDays(2), channelId: CH.ig, channelService: "instagram", metadata: { __typename: "InstagramPostMetadata" }, assets: [img(2, "IMG_2041"), img(3, "Two designers sketching at a whiteboard")] },
    { id: "6500000000000000000000a3", text: "Thread: 5 things we learned shipping alt text 🧵", status: "scheduled", dueAt: inDays(3), channelId: CH.x, channelService: "twitter", metadata: { __typename: "TwitterPostMetadata", threadCount: 5 }, assets: [] },
    { id: "6500000000000000000000a4", text: "Weekly tip: describe charts in your alt text, not just 'chart'.", status: "scheduled", dueAt: inDays(4), channelId: CH.li, channelService: "linkedin", metadata: { __typename: "LinkedInPostMetadata" }, assets: [] },
    { id: "6500000000000000000000a5", text: "Draft: 𝘸𝘦'𝘳𝘦 𝘩𝘪𝘳𝘪𝘯𝘨 ✨✨✨ #womenintech", status: "draft", dueAt: null, channelId: CH.ig, channelService: "instagram", metadata: null, assets: [img(4, "image")] },
  ].map((p) => [p.id, p]),
);

function headers(res, extra = {}) {
  res.setHeader("RateLimit", `"100-in-15min"; r=${remaining15}; t=812, "500-in-1day"; r=${400 + remaining15}; t=80000`);
  res.setHeader("RateLimit-Policy", `"100-in-15min"; q=100; w=900; pk=:bW9jaw==:, "500-in-1day"; q=500; w=86400; pk=:bW9jaw==:`);
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
}
const json = (res, status, body, extra) => {
  headers(res, extra);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => r(s)); });

function issueTokens() {
  const access = b64url(randomBytes(24));
  const refresh = b64url(randomBytes(24));
  accessTokens.add(access);
  refreshTokens.add(refresh);
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: Number(process.env.MOCK_EXPIRES_IN ?? 3600), scope: "account:read posts:read posts:write notes:write offline_access" };
}

function gql(query, variables) {
  const op = query.match(/(query|mutation)\s+(\w+)/)?.[2];
  log.push({ op, variables });
  switch (op) {
    case "Account":
      return { account: { id: "acct_1", email: "demo@legible.test", name: "Demo Poster", timezone: "Asia/Dhaka", organizations: [{ id: ORG, name: "Legible Demo Org" }] } };
    case "Channels":
      return { channels: [
        { id: CH.li, name: "legible-co", displayName: "Legible Co", service: "linkedin", avatar: "", timezone: "Asia/Dhaka", isDisconnected: false, isQueuePaused: false },
        { id: CH.ig, name: "legible.studio", displayName: "Legible Studio", service: "instagram", avatar: "", timezone: "Asia/Dhaka", isDisconnected: false, isQueuePaused: false },
        { id: CH.x, name: "legibleapp", displayName: null, service: "twitter", avatar: "", timezone: "Asia/Dhaka", isDisconnected: false, isQueuePaused: false },
      ] };
    case "Scan": {
      const all = [...posts.values()];
      return {
        upcoming: { edges: all.filter((p) => p.status !== "draft").map((node) => ({ node })), pageInfo: { hasNextPage: false } },
        drafts: { edges: all.filter((p) => p.status === "draft").map((node) => ({ node })), pageInfo: { hasNextPage: false } },
      };
    }
    case "Post":
      return { post: posts.get(variables.id) };
    case "EditPost": {
      const { input } = variables;
      const post = posts.get(input.id);
      if (!post) return { editPost: { __typename: "NotFoundError", message: "Post not found" } };
      if (input.mode !== undefined) throw new Error("Legible must not change the schedule");
      if (input.text !== undefined) post.text = input.text;
      if (input.assets) {
        if (input.assets.length !== post.assets.length) throw new Error("asset count changed");
        post.assets = input.assets.map((a, i) => {
          const old = post.assets[i];
          if (a.image) return { ...old, source: a.image.url, image: { altText: a.image.metadata.altText, userTags: a.image.metadata.userTags ?? null } };
          return old;
        });
      }
      return { editPost: { __typename: "PostActionSuccess", post } };
    }
    case "CreateNote":
      return { createCollaborationNote: { __typename: "CreateCollaborationNoteSuccess", edge: { node: { id: "note_" + log.length } } } };
    default:
      throw new Error(`Unknown operation ${op}`);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "GET" && url.pathname === "/auth") {
    const p = url.searchParams;
    if (p.get("code_challenge_method") !== "S256" || !p.get("code_challenge") || !p.get("state")) {
      res.writeHead(400).end("PKCE S256 and state are required");
      return;
    }
    const code = b64url(randomBytes(16));
    codes.set(code, { challenge: p.get("code_challenge"), redirectUri: p.get("redirect_uri") });
    const back = new URL(p.get("redirect_uri"));
    back.searchParams.set(process.env.MOCK_DENY ? "error" : "code", process.env.MOCK_DENY ? "access_denied" : code);
    back.searchParams.set("state", p.get("state"));
    res.writeHead(302, { Location: back.toString() }).end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/token") {
    const p = new URLSearchParams(await readBody(req));
    if (!p.get("client_secret")) return json(res, 401, { error: "invalid_client" });
    if (p.get("grant_type") === "authorization_code") {
      const entry = codes.get(p.get("code"));
      codes.delete(p.get("code"));
      const ok = entry && entry.redirectUri === p.get("redirect_uri") && b64url(createHash("sha256").update(p.get("code_verifier") ?? "").digest()) === entry.challenge;
      return ok ? json(res, 200, issueTokens()) : json(res, 400, { error: "invalid_grant", error_description: "PKCE or redirect_uri mismatch" });
    }
    if (p.get("grant_type") === "refresh_token") {
      const rt = p.get("refresh_token");
      if (!refreshTokens.has(rt)) return json(res, 400, { error: "invalid_grant", error_description: "Refresh token reused or unknown" });
      refreshTokens.delete(rt);
      log.push({ op: "refresh" });
      return json(res, 200, issueTokens());
    }
    return json(res, 400, { error: "unsupported_grant_type" });
  }
  if (req.method === "GET" && url.pathname === "/__log") return json(res, 200, { log, posts: [...posts.values()] });
  if (req.method === "POST" && (url.pathname === "/graphql" || url.pathname === "/")) {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!accessTokens.has(token)) return json(res, 401, { errors: [{ message: "Unauthorized" }] });
    if (remaining15 <= 0) return json(res, 429, { errors: [{ message: "Too many requests", extensions: { code: "RATE_LIMIT_EXCEEDED", window: "15m" } }] }, { "Retry-After": "753" });
    remaining15--;
    const { query, variables } = JSON.parse(await readBody(req));
    try {
      return json(res, 200, { data: gql(query, variables ?? {}) });
    } catch (err) {
      return json(res, 200, { errors: [{ message: String(err.message) }] });
    }
  }
  res.writeHead(404).end();
});
server.listen(PORT, () => console.log(`mock Buffer listening on http://localhost:${PORT}`));
