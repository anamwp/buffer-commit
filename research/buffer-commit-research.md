# Buffer Commit — Research Notes

Researched **2026-11-05**. Each claim links its source. Anything not confirmed in a source is marked **ASSUMPTION**.

## 0. Source access log

| Source | Status | How it was read |
|---|---|---|
| [buffer.com/api/commit](https://buffer.com/api/commit) | ✅ Fetched | Direct |
| [buffer.com/api/commit/terms](https://buffer.com/api/commit/terms) | ✅ Fetched | Direct |
| [developers.buffer.com](https://developers.buffer.com) + 21 guides + [reference](https://developers.buffer.com/reference.html) + [changelog](https://developers.buffer.com/changelog.html) + [API roadmap](https://developers.buffer.com/roadmap.html) | ✅ Fetched | Raw HTML, converted locally |
| [Developer Handbook (Notion)](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) | ✅ Fetched | `buffer.notion.site` is blocked by this session's network policy, so it was read through the Notion connector (page last edited 2026-10-22) |
| [suggestions.buffer.com](https://suggestions.buffer.com) and [/roadmap](https://suggestions.buffer.com/roadmap) | ❌ **Not fetchable** | DNS blocked by the session network policy, and web search returned no board posts. **Substitute:** the [developers.buffer.com API roadmap](https://developers.buffer.com/roadmap.html) (updated Nov 4, 2026). It lists the API-tagged suggestions-board posts with vote counts and links back to `suggestions.buffer.com/p/...`. **Action for you:** skim the main board for non-API product requests before you lock in the final idea. |
| Case studies: [PostIQ](https://buffer.com/resources/postiq-case-study), [Hiding Elephant](https://buffer.com/resources/hiding-elephant-case-study), [WriteStack](https://buffer.com/resources/writestack-case-study), [Pokémon Cards](https://buffer.com/resources/pokemon-cards) | ✅ Fetched | Direct |
| [buffer.com/mcp](https://buffer.com/mcp), [buffer.com/integrations](https://buffer.com/integrations) (+ [WordPress](https://buffer.com/integrations/wordpress), [Nelio](https://buffer.com/integrations/nelio-content), [Evergreen](https://buffer.com/integrations/evergreen-content-poster) detail pages) | ✅ Fetched | Direct |
| [github.com/bufferapp/buffer-sample-apps](https://github.com/bufferapp/buffer-sample-apps) | ⚠️ 403 from the proxy | Known only from the [Building Apps guide](https://developers.buffer.com/guides/building-apps.html). It includes `app-client-starter-app` (OAuth+PKCE, refresh, GraphQL, Vercel deploy). |

---

## 1. Rules and dates

| Item | Detail | Source |
|---|---|---|
| Build window | Oct 28 – Nov 13, 2026 | [commit](https://buffer.com/api/commit) |
| Deadline | **Nov 13, 11:59 PM PT**. PST is in effect (US DST ended Nov 1), so this is **Nov 14, 07:59 UTC = Nov 14, 1:59 PM in Bangladesh (UTC+6)** | [terms](https://buffer.com/api/commit/terms) |
| Judging | ~Nov 16–20. Winners notified ~Dec 4–7 and announced Dec 7 | [terms](https://buffer.com/api/commit/terms), [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) |
| Must-haves | Works end to end, uses **Buffer OAuth**, makes ≥1 real API call, publicly available at submission and through judging, follows API terms and rate limits | [commit](https://buffer.com/api/commit), [terms](https://buffer.com/api/commit/terms) |
| App client, not API key | "Your submission has to be an app client to be eligible." Use a **private (confidential)** client for web apps | [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) |
| Extra clients | Participants get +2 app clients regardless of plan | [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) |
| Submission | Demo video **≤ 2 min** against the live API, public app URL, ~**300-word** summary, names/emails/handles, **client ID** (never the secret), optional build-in-public trail of **≤ 5 posts** | [terms](https://buffer.com/api/commit/terms) |
| Final | Submissions can't be edited once sent | [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) |
| Branding | You can't use "Buffer" in the app name, put Buffer's logo in your logo, or style the app to look like Buffer. "Built on the Buffer API" is fine | [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) |
| Multiple entries | Allowed if substantially different, but you can only be part of one Commit Award winner | [commit](https://buffer.com/api/commit) |
| IP | You keep ownership. Buffer gets a non-exclusive promotional license | [terms](https://buffer.com/api/commit/terms) |
| Eligibility | 18+. Bangladesh is **not** on the excluded list | [terms](https://buffer.com/api/commit/terms) |

## 2. Judging

| Criterion | Weight | Notes | Source |
|---|---|---|---|
| Real usefulness | 1–5, equal | **Breaks ties at the cut-off** | [terms](https://buffer.com/api/commit/terms) |
| Technical execution & craft | 1–5, equal | | [terms](https://buffer.com/api/commit/terms) |
| Creativity & originality | 1–5, equal | | [terms](https://buffer.com/api/commit/terms) |
| Qualifying bar | **≥ 9 / 15** averaged across 3 judges. Up to 16 winners share $25,600 (≥ $1,600 each) | | [terms](https://buffer.com/api/commit/terms) |
| Delight Award | ≤ 3 winners, "most distinctive user experience", picked by the design team | | [commit](https://buffer.com/api/commit) |
| Build-in-Public Award | ≤ 3 winners, picked by the content team. Posts must be public, dated Oct 15 – Nov 13, and mention Buffer Commit. Not scored for the main award | | [commit](https://buffer.com/api/commit), [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) |

The handbook's brief: *"build a web app or an integration that makes creating and publishing content noticeably better, using the Buffer API to power at least one of its core features… a capability Buffer doesn't have yet or a bridge between Buffer and a tool people already rely on."* ([handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8))

Video tips from the handbook: show the working product, not slides. Point out where the Buffer API is used. The deployed version must match what the video shows.

---

## 3. API capabilities

### 3.1 Basics

| Fact | Source |
|---|---|
| **GraphQL**, a single endpoint: `POST https://api.buffer.com` with `Authorization: Bearer` | [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8), [auth](https://developers.buffer.com/guides/authentication.html) |
| GraphQL returns HTTP 200 even on errors. Mutations return unions, so always select `... on MutationError { message }` | [error handling](https://developers.buffer.com/guides/error-handling.html) |
| Data model: Account → Organizations → Channels → Posts. Ideas and Tags belong to the organization | [data model](https://developers.buffer.com/guides/data-model.html) |
| Platforms for posting: Instagram, Threads, LinkedIn, X, Facebook, Google Business Profiles, Mastodon, YouTube, Pinterest, Bluesky, TikTok, Substack. The `Service` enum also has `startPage` and `whatsapp` | [posts & scheduling](https://developers.buffer.com/guides/posts-and-scheduling.html), [reference](https://developers.buffer.com/reference.html) |
| **No webhooks**: "There are no webhooks, so keeping data in sync means polling." Filter on `createdAt: { start: $checkpoint }` | [efficient usage](https://developers.buffer.com/guides/efficient-api-usage.html) |
| **No media upload**: assets must be public, direct, HTTPS URLs that stay stable until the post publishes. Pre-signed URLs fail silently. Some WordPress hosts or Cloudflare bot protection block Buffer's fetcher | [hosting media](https://developers.buffer.com/guides/hosting-media.html) |
| **Post metrics are not available to app clients.** They need the `insightsRead` scope, which OAuth can't grant | [post metrics](https://developers.buffer.com/guides/post-metrics.html), [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8) |
| Safe testing: `saveToDraft: true` validates and creates a draft but never publishes | [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8), [reference](https://developers.buffer.com/reference.html) |
| No official SDK. Tools: [GraphQL Explorer](https://developers.buffer.com/explorer.html), [CLI](https://developers.buffer.com/guides/cli.html), and an [MCP server](https://developers.buffer.com/guides/integrations.html) | [docs home](https://developers.buffer.com) |

### 3.2 OAuth

Source: [Authentication](https://developers.buffer.com/guides/authentication.html), [Building Apps](https://developers.buffer.com/guides/building-apps.html).

- **Authorization Code + PKCE (S256) is required for every client**, including confidential ones.
- Authorize at `GET https://auth.buffer.com/auth`. Token exchange and refresh at `POST https://auth.buffer.com/token`.
- `state` is required to prevent CSRF.
- Redirect URIs must match **character for character** and must be **HTTPS, even on localhost**. Multiple URIs per client are allowed.
- Access tokens last about 1 hour (`expires_in: 3600`). A refresh token is issued only if you request `offline_access`.
- **Refresh tokens rotate and are single-use. Reusing an old one revokes the whole grant.** Refreshes need a single-writer lock.
- Store tokens server-side only: an encrypted HttpOnly cookie, or a DB/KV for anything beyond a toy.
- Handle a `401` by prompting the user to re-authorize. Users can revoke access from Buffer settings.
- On serverless, "Invalid state" almost always means an in-memory session store. Use an encrypted cookie or a shared store ([handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8)).

**Scopes** ([auth](https://developers.buffer.com/guides/authentication.html), [notes](https://developers.buffer.com/guides/notes.html), [tags](https://developers.buffer.com/guides/tags.html), [content items](https://developers.buffer.com/guides/content-items.html))

| Scope | Grants |
|---|---|
| `account:read` | Account, organizations, channels |
| `account:write` | Update account settings |
| `posts:read` | Posts and queue. Also tags (read) and content items (read) |
| `posts:write` | Create, edit and delete posts. Also tag writes and content-item writes |
| `ideas:read` / `ideas:write` | Ideas |
| `snippets:read` / `snippets:write` | Snippets |
| `notes:read` / `notes:write` | Collaboration Notes (experimental) |
| `offline_access` | Refresh token |

The handbook says most projects start with `account:read posts:write`.

### 3.3 Rate limits ⚠️ (the sources conflict, so plan for the lower numbers)

| Source | 15 min | 24 h | 30 days |
|---|---|---|---|
| [Rate Limits guide](https://developers.buffer.com/guides/api-limits.html), app client | 100 base +10 per authorized user | 500 base +25 per user | 15,000 base +100 per user (up to 1,000 users counted) |
| [Handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8), Free tier | 100 | **250** | **3,000** |

- The handbook says limits are **"per client, not per user: everyone who connects to your app shares your quota, judges included."**
- Every response carries `RateLimit` headers (`r` = remaining, `t` = seconds until reset), one per window. Match windows by `w` (900 / 86400 / 2592000).
- A `429` includes `Retry-After` and `extensions.window`. A 429 does not consume quota. Wait out short resets and surface long ones on serverless.
- Query limits: complexity ≤ 175,000, depth ≤ 25, ≤ 30 aliases, ≤ 50 directives, ≤ 15,000 tokens.
- Need more? Email `developersupport@buffer.com`.
- Posting limits are separate. Read them with `dailyPostingLimits`.

**Design rule for every idea:** at most ~250 calls/day across *all* users. Cache org and channel IDs per session, batch through `createContentItem` where possible, never poll on page load, and show a "budget" state when `r` gets low.

### 3.4 Confirmed operations

Source: the [API reference](https://developers.buffer.com/reference.html). "Exp." means marked Experimental or Preview, which can change without deprecation.

| Operation | Kind | Scope | What it's for | Exp.? |
|---|---|---|---|---|
| `account` | Q | account:read | id, email, name, **timezone**, `organizations { id name limits }` | |
| `channels(input:{organizationId})` | Q | account:read | `id name service avatar timezone isQueuePaused isDisconnected isLocked postingSchedule{day times paused}` | |
| `channel(input:{id})` | Q | account:read | Single channel, plus metadata such as Pinterest boards and Mastodon `maxCharacters` | |
| `posts(first, after, input:{organizationId, filter, sort})` | Q | posts:read | Filter by `channelIds, status[draft/error/needs_approval/scheduled/sending/sent], dueAt{start,end}, createdAt, tagIds, postTypes`. Cursor pagination | |
| `post(input:{id})` | Q | posts:read | Includes `assets{… on ImageAsset{source image{altText}}}`, `error{message supportUrl}`, `dueAt`, `externalLink` | |
| `createPost` | M | posts:write | `text, channelId, schedulingType, mode[addToQueue/customScheduled/shareNext/shareNow], dueAt, saveToDraft, assets, metadata, tagIds, ideaId, aiAssisted` | |
| `editPost` | M | posts:write | Edit text, assets (omit to keep, or pass the full list), dueAt, mode, metadata | |
| `deletePost` | M | posts:write | | |
| `movePostInQueue(input:{id, position:top/bottom})` | M | posts:write ⚠️ ASSUMPTION | | Exp. |
| `dailyPostingLimits(input:{channelIds, date})` | Q | posts:read ⚠️ ASSUMPTION | `isAtLimit, limit, scheduled, sent` | |
| `ideas(first, after, input:{organizationId, groupFilter, tagsFilter})` | Q | ideas:read | `content{title text media services date tags}` | |
| `ideaGroups` / `createIdea` | Q / M | ideas:read / ideas:write | | |
| `tagsV2`, `tag`, `createTag`, `updateTag`, `deleteTag` | Q / M | posts:read / posts:write | | Exp. |
| `contentItem(s)`, `createContentItem`, `createContentItemDraft`, `promoteContentItemDraftToPosts`, `updateContentItem(Draft)`, `add/removePostToContentItem`, `deleteContentItem` | Q / M | posts:read / posts:write | Groups per-channel variants. **All-or-nothing validation in one call** | Exp. |
| `collaborationNotes`, `create/update/deleteCollaborationNote` | Q / M | notes:read / notes:write | Comments on a post or a channel-less draft | Exp. |
| `snippets`, `create/update/deleteSnippet` | Q / M | snippets:read / snippets:write | | Exp. |
| `postTemplate(s)`, `create/update/deletePostTemplate` | Q / M | ⚠️ scope not documented | Templates with `{{placeholders}}` | Preview |
| `configuration(input)` | Q | ⚠️ not documented | Per-channel capability catalog | Exp. |
| `aggregatedPostMetrics`, `Post.metrics` | Q | **insightsRead, which app clients can't get** | ❌ Not usable | |

**Character limits** ([guide](https://developers.buffer.com/guides/character-limits.html)): X 280 (Free tier) or 25,000, LinkedIn 3,000, Instagram 2,196, Threads 500, Bluesky 300, Pinterest 500, Mastodon set by the server (`maxCharacters`), GBP 4,000, YouTube 5,000 with no `<` or `>`, Substack 10,000.

Counting is in **UTF-16 code units**, so emoji and Unicode bold count as 2. Network-specific rules: LinkedIn counts every URL as 24, Instagram counts each line break as 2, Mastodon counts URLs as 23, and X uses its own weighting.

---

## 4. Demand signals (suggestions board, via the API roadmap mirror)

From the [API roadmap](https://developers.buffer.com/roadmap.html), updated Nov 4, 2026. Votes are shown in brackets.

| Request | Votes | Status | What a third-party app could do about it |
|---|---|---|---|
| [Image assets for API](https://suggestions.buffer.com/p/image-assets-for-api) (no upload, so you need your own hosting) | 24 | Exploring | **An app can host the media for the user** (R2 or Cloudinary) and hide the problem entirely |
| [Community API](https://suggestions.buffer.com/p/community-api) (comment replies) | 21 | Exploring | ❌ No endpoints exist yet, so not buildable |
| [Claude Code skill](https://suggestions.buffer.com/p/can-you-create-a-claude-code-skill) | 20 | Exploring | Dev-tooling niche |
| [Copy media to Buffer storage](https://suggestions.buffer.com/p/copy-media-to-buffer-storage-after-post-creation) | 18 | Exploring | Same as the first row: stable app-side hosting |
| [Video in createIdea](https://suggestions.buffer.com/p/support-video-media-in-createidea-public-api) | 11 | Exploring | Avoid video ideas |
| [Analytics in MCP](https://suggestions.buffer.com/p/need-more-analytics-capabilities-inside-of-mcp) | 6 | Exploring | ❌ Metrics are closed to app clients |
| [API permissions/scopes](https://suggestions.buffer.com/p/api-permissions-scopes): *"draft a post or create an idea automatically via GitHub workflow when we merge a community-created pull request… the API key cannot be used to directly publish"* | 4 | Exploring | **An OAuth app with ideas/draft-only behaviour solves this exact use case** |
| [Link shortening](https://suggestions.buffer.com/p/link-shortening) | 3 | Exploring | |
| [Query Ideas](https://suggestions.buffer.com/p/query-ideas) | 11 | Beta (now `ideas` query) | Ideas as the "seed" for posts is supported now |
| [API for Post Analytics](https://suggestions.buffer.com/p/api-for-post-analytics) | 58 | Released (personal key only) | ❌ Not for apps |
| [Document LinkedIn limit & Unicode handling](https://suggestions.buffer.com/p/document-linkedin-character-limit-and-unicode-handling-in-buffer-docs) | 5 | Released (docs) | Shows **character-counting pain is real**, and it's worth validating before submit |
| [When creating a post… set tags](https://suggestions.buffer.com/p/when-creating-a-post-using-the-api-you-also-need-to-set-tags) | 1 | Released (`tagIds`) | |
| [Instagram firstComment not persisted](https://suggestions.buffer.com/p/instagram-firstcomment-field-not-persisted-when-creating-posts-via-api), [Pinterest url ignored](https://suggestions.buffer.com/p/pinterest-post-metadata-url-field-is-ignored-when-creating-posts-via-api), [duplicate detection](https://suggestions.buffer.com/p/duplicate-post-detection-blocks-new-post-creation-via-api-after-original-drafts-deleted) | 1–3 | Released (fixed) | Per-network edge cases. Test them |

Other signals:
- The PostIQ founder built a content calendar *"after he saw the same feature requested on Buffer's public roadmap"* ([PostIQ](https://buffer.com/resources/postiq-case-study)).
- Hiding Elephant says *"the edge cases took more work. Every platform has its own character limits, supported media types, and publishing rules"* ([Hiding Elephant](https://buffer.com/resources/hiding-elephant-case-study)).

**Gap summary.** A third-party app can't do analytics or comments. It **can** do these well:
- (a) media hosting on the user's behalf
- (b) per-network validation and formatting
- (c) safe draft-only automation from other tools
- (d) queue hygiene, using posting schedules, error states and limits
- (e) collaboration through Notes

## 5. What already exists (don't duplicate)

| Existing | What it does | Source |
|---|---|---|
| **PostIQ** | Drafting, Thread Splitter (LinkedIn → Threads/X), content calendar, approvals. Spin-off **Receipts**: no-login client approval links with timestamped receipts | [case study](https://buffer.com/resources/postiq-case-study) |
| **Hiding Elephant** | AI design workspace: on-brand images and video, aspect-ratio reframing, platform captions, 1-click publish | [case study](https://buffer.com/resources/hiding-elephant-case-study) |
| **WriteStack** | Substack Notes scheduling plus cross-posting to LinkedIn, X and others via Buffer | [case study](https://buffer.com/resources/writestack-case-study) |
| **Pokémon Cards** | AI reads card photos → **WooCommerce** product → Buffer promo posts per channel | [case study](https://buffer.com/resources/pokemon-cards) |
| **WordPress to Buffer** (WP Zinc) | Auto-queues new WP posts on publish (free and Pro) | [integration](https://buffer.com/integrations/wordpress) |
| **Nelio Content** | WP editorial calendar, auto-generated social messages per post, sent to Buffer on publish | [integration](https://buffer.com/integrations/nelio-content) |
| **Evergreen Content Poster** | WP plugin that recycles posts, pages and Woo products into the Buffer queue | [integration](https://buffer.com/integrations/evergreen-content-poster) |
| **Buffer MCP** | Claude, ChatGPT, Cursor, Raycast, Perplexity, Notion, Zapier, n8n, Manus and Antigravity can draft and schedule posts, check the queue, and save ideas | [mcp](https://buffer.com/mcp), [integrations](https://buffer.com/integrations) |
| Others | Bitly, Canva, Dropbox, Google Drive and Photos, OneDrive, Unsplash, Feedly, Quuu, IFTTT, Make, Power Automate, Zapier, OpenAI assistant | [integrations](https://buffer.com/integrations) |

**What to avoid:**
- WordPress "auto-share on publish", WP evergreen recycling, and Woo product → promo posts are all taken.
- So are "AI writes captions for a design", "thread splitter", "content calendar", "approval links" and "chat with an AI to schedule" (MCP).

**Where nobody is yet:**
- Accessibility QA of the queue
- Release/changelog-to-social with draft-only safety
- Phone-first field capture with hosted media
- Guided weekly queue maintenance
- In-editor, network-accurate composition inside Gutenberg, beyond auto-share
