# Legible

**An accessibility check for your Buffer queue.** Legible finds missing alt text, "fancy" Unicode that screen readers
can't read, all-lowercase multi-word hashtags, emoji walls and all-caps runs in your scheduled posts and drafts. It
fixes them before they publish and lets you **hear each post the way a screen-reader user does**.

Built on the [Buffer API](https://developers.buffer.com) for Buffer Commit 2026. The plan behind it is in
[`../ideas/01-legible`](../ideas/01-legible/README.md).

## What works today

| Feature | Status |
|---|---|
| Buffer OAuth 2.0 (Authorization Code + PKCE S256, `state`, private client) | ✅ |
| Encrypted token store (AES-256-GCM) with a single-writer refresh lease for rotating refresh tokens | ✅ |
| Scan: next 14 days of scheduled/awaiting-approval posts plus recent drafts in **one** API request (aliased `posts` connections) | ✅ |
| 8 rules: alt missing, alt weak, fancy Unicode, hashtag CamelCase (dictionary segmentation), emoji runs, emoji density, caps runs, hashtag overload | ✅ |
| "Hear it" before/after via the Web Speech API, plus a transcript of what a screen reader announces | ✅ |
| Quick deterministic fixes, and AI suggestions (Claude vision for alt text, structured output) | ✅ (AI needs `ANTHROPIC_API_KEY`) |
| Apply via `editPost`: re-reads the post first, sends only changed fields, never touches the schedule, preserves all assets and Instagram user tags | ✅ |
| Threads are detected and never edited | ✅ |
| Leave a Buffer Note (`createCollaborationNote`) | ✅ |
| Shared rate-limit budget meter (from `RateLimit` headers), 429 handling, 5-minute scan cooldown | ✅ |
| Landing-page playground that works with no sign-in | ✅ |
| Disconnect & delete my data | ✅ |

## Run it locally

Requires Node 20+ and pnpm.

```bash
cd legible
pnpm install
cp .env.example .env.local   # fill in the values, see below
pnpm dev                     # https://localhost:3000 (self-signed cert)
```

- **Buffer app client:** go to Buffer → Settings → API → App Clients → New Client and choose **private**. Permissions: account:read, posts:read,
  posts:write, notes:write. Redirect URI: `https://localhost:3000/auth/buffer/callback`. Buffer requires HTTPS even
  on localhost, which is why `pnpm dev` uses `--experimental-https`.
- `SESSION_SECRET`: `openssl rand -base64 48`. `TOKEN_ENC_KEY`: `openssl rand -base64 32`.
- Leave `DATABASE_URL` empty to use an embedded PGlite database in `.data/` (no Postgres needed). Migrations run
  automatically.

### Without a Buffer account: the mock

`scripts/mock-buffer.mjs` stands in for `auth.buffer.com` and `api.buffer.com`. It enforces PKCE and state, rotates
refresh tokens, sends real-shaped `RateLimit` headers, and serves a demo queue.

```bash
pnpm mock:buffer &
BUFFER_API_URL=http://localhost:4010/graphql BUFFER_AUTH_URL=http://localhost:4010 \
REDIRECT_URI=http://localhost:3000/auth/buffer/callback pnpm next dev
```

## Tests

```bash
pnpm test        # unit: rules, speech transcript, PKCE (RFC 7636 vector), rate-limit parsing, editPost asset rebuild
pnpm typecheck && pnpm lint
pnpm test:e2e    # Playwright against the running app + mock (see .github/workflows/legible-ci.yml)
```

The E2E smoke test covers the playground, OAuth, a scan, the cooldown, a text + alt-text fix, an alt-only fix that
must preserve the other images and user tags, a read-only thread with a Note, and the dashboard updating afterwards.

## Deploy (Vercel + Neon)

1. Create a Neon project and copy the pooled connection string to `DATABASE_URL`.
2. Import the repo into Vercel with **Root Directory = `legible`**. Set every variable from `.env.example` (production
   values, with `REDIRECT_URI=https://<your-domain>/auth/buffer/callback`).
3. Add that redirect URI to the Buffer app client, keeping the localhost one.
4. Smoke test: connect, scan, fix a draft, reconnect.
5. Point an uptime monitor at `/api/health`. It checks the database and makes **no** Buffer call.

## Architecture

```
src/lib/rules      pure, deterministic checks + scoring (runs in the browser and on the server)
src/lib/speech     "what a screen reader says" transcript (emoji CLDR names, math letters)
src/lib/buffer     GraphQL client, operations, PKCE, rate-limit header parser, typed errors
src/lib/server     env, crypto, session, OAuth, token refresh lease, scan service, AI suggestions
src/lib/db         Drizzle schema; Neon (HTTP) in production, PGlite locally
src/app            Next.js App Router pages, OAuth routes, server actions
```

### Buffer API usage

| Operation | Scope | When |
|---|---|---|
| `account` | account:read | Once at sign-in |
| `channels` | account:read | Cached for 30 minutes |
| `posts` ×2 (aliased, one request) | posts:read | On "Scan" (5-minute cooldown) |
| `post` | posts:read | Just before applying a fix, to detect newer edits |
| `editPost` | posts:write | On "Apply to Buffer" (`mode` omitted, so the schedule is unchanged) |
| `createCollaborationNote` | notes:write | On "Add note" |

## Known limitations / to verify against the live API

- Whether every network forwards alt text from Buffer. Legible sets it on the Buffer post; it doesn't claim more than that.
- Notes and Content Items are marked experimental in Buffer's docs.
- Not tested against the real Buffer API from this environment (no credentials). The mock follows the documented shapes.
  Verify on day 1 with `saveToDraft` test posts.
