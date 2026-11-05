# Shared Foundation (used by every idea)

All five plans reuse this base. Build it once, on Day 1, and it carries over to whichever idea you pick. Sources are in [`research/buffer-commit-research.md`](../research/buffer-commit-research.md).

## 1. Buffer OAuth module (confidential client, PKCE + state)

```
GET  /auth/buffer/start     → make state (32B) + code_verifier (32B), save both in a sealed cookie (10 min TTL),
                              302 to https://auth.buffer.com/auth?client_id&redirect_uri&response_type=code
                              &scope=<minimal>+offline_access&state&code_challenge&code_challenge_method=S256&prompt=consent
GET  /auth/buffer/callback  → check state (constant-time), handle ?error=access_denied,
                              POST https://auth.buffer.com/token (client_secret + code_verifier),
                              encrypt tokens, upsert connection row, rotate the session ID, 302 /app
POST /auth/logout           → destroy session, delete tokens
```

- **PKCE is required even for confidential clients** ([handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8)).
- `state` and the verifier live in an `iron-session` sealed cookie, never in memory. That avoids the "Invalid state" failure on serverless.
- Read `REDIRECT_URI` from env and `.trim()` it. Register both `https://localhost:3000/auth/buffer/callback` and the production URL ([building apps](https://developers.buffer.com/guides/building-apps.html)).
- Local HTTPS: `next dev --experimental-https` (self-signed), or `mkcert`.

## 2. Token store (Postgres) with a single-writer refresh

```sql
create table users        (id uuid pk default gen_random_uuid(), buffer_account_id text unique not null,
                           email text, timezone text, created_at timestamptz default now());
create table connections  (user_id uuid pk references users on delete cascade,
                           access_token_enc bytea not null, refresh_token_enc bytea not null,
                           expires_at timestamptz not null, scope text not null,
                           key_version int not null default 1, updated_at timestamptz default now());
create table api_budget   (window_s int pk, remaining int, resets_at timestamptz, seen_at timestamptz);
```

- **Encryption:** AES-256-GCM (Node `crypto`). Store a random 12-byte IV and the auth tag alongside the ciphertext. The key is `TOKEN_ENC_KEY` (32 bytes, base64) held only in host secrets. `key_version` allows key rotation.
- **Refresh:** start refreshing 60 s before `expires_at`. Do it inside a transaction with `select … for update` on the connection row. **Write the new refresh token before using the new access token.** Never retry a failed refresh with the same token, because refresh tokens rotate and reuse revokes the grant ([auth](https://developers.buffer.com/guides/authentication.html)).
- A `401` or `invalid_grant` marks the connection `needs_reauth` and shows a "Reconnect Buffer" banner.

## 3. Buffer GraphQL client

- A single `bufferRequest(user, query, variables)` function.
- Parse every `RateLimit` header (`r`, `t`) and match windows by `w`. Upsert the values into `api_budget`.
- When the remaining 24-hour budget is under 10%, defer non-essential reads and serve from cache.
- On `429`, read `Retry-After`. Wait if it's ≤ 5 s, otherwise throw `RateLimited(window, retryAfter)` and show a friendly "Buffer needs a breather, try again in 12 min" state ([rate limits](https://developers.buffer.com/guides/api-limits.html)).
- Check the union result of every mutation and select `... on MutationError { message }`.
- Cache `account`, `organizations` and `channels` in the DB for 30 min. Refresh only on user action.
- Use typed operations via `graphql-codegen` against an introspected schema snapshot, so experimental fields are pinned.

## 4. Standard stack (web ideas)

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | Next.js 15 (App Router, Route Handlers, Server Actions), TypeScript | Your strongest JS stack. One deploy unit |
| UI | Tailwind + Radix primitives + Framer Motion | Accessible primitives and fast polish for the Delight Award |
| DB | Neon Postgres (free) + Drizzle ORM | You're learning Postgres. Serverless driver. Free tier stays up |
| Session | `iron-session` (sealed HttpOnly, Secure, SameSite=Lax cookie) | No server session store needed |
| Secrets | Vercel env vars (Production and Preview kept separate) | Never committed. `.env.example` only |
| Hosting | Vercel Hobby | Free, preview deploys, cron ([fine for non-commercial contest use, ASSUMPTION: confirm the plan terms]) |
| Errors | Sentry (free Developer plan) | Stack traces with source maps |
| Uptime | Better Stack or UptimeRobot free, 5-min checks on `/api/health` and `/` | Gets you through Dec 7 |
| CI | GitHub Actions: `pnpm i --frozen-lockfile → lint → typecheck → vitest → playwright (smoke)` | Gate merges to `main` |
| Domain | Cloudflare Registrar (~$10/yr) CNAME → Vercel | A real domain reads as craft |

## 5. Zero to production checklist (shared)

1. `pnpm create next-app`, enable TS strict, ESLint and Prettier. Add `.env.example`, `SECURITY.md` and an MIT `LICENSE`.
2. In Buffer, go to **Settings → API → App Clients → New Client**. Choose **private**. Set the name and logo (not Buffer branding), a privacy policy URL, the **minimal permissions**, and redirect URIs for both localhost (HTTPS) and production ([building apps](https://developers.buffer.com/guides/building-apps.html)).
3. Set these env vars: `BUFFER_CLIENT_ID`, `BUFFER_CLIENT_SECRET`, `REDIRECT_URI`, `SESSION_SECRET` (32+ random bytes), `TOKEN_ENC_KEY`, `DATABASE_URL`, `SENTRY_DSN`, plus any idea-specific ones.
4. Neon: create a project and run `drizzle-kit migrate` from CI on deploy to `main`.
5. Vercel: import the repo, set env vars per environment, add the domain, then run the smoke test (connect → list channels → create a `saveToDraft` post → reconnect).
6. Sentry: install `@sentry/nextjs` and scrub `Authorization` headers and tokens in `beforeSend`.
7. Uptime: monitor `/api/health` (a DB ping, **with no Buffer call**, so monitoring doesn't burn quota). Alert by email and push.
8. **Freeze `main` from Nov 13 until Dec 7.** Only critical fixes, each deployed with a smoke test. Calendar reminders on Nov 20 and Dec 1: check that the domain, Neon (free compute can suspend, which is fine because it auto-resumes) and the Buffer client are all healthy.
9. Privacy page: what data is stored (tokens and cached post text), the retention period, and how to delete it (a "Disconnect & delete my data" button).

## 6. Shared security baseline

- Minimal scopes per idea. Every idea requests `offline_access` so judges don't have to reconnect every hour.
- CSRF: SameSite=Lax cookies plus `state`. Server Actions get Next's built-in origin check.
- Headers: CSP (`default-src 'self'`, with image allow-lists), HSTS, `X-Frame-Options: DENY`.
- Never send tokens to the browser. Never log them. Sentry scrubbing is on.
- Rotate the client secret if it leaks ([building apps](https://developers.buffer.com/guides/building-apps.html)). Submit only the **client ID** ([terms](https://buffer.com/api/commit/terms)).
- Dependabot and `pnpm audit` run in CI.
