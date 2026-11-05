# Comparison & Recommendation

Scores run 1–5. The three judged criteria are weighted equally and averaged across judges, with a qualifying bar of ≥ 9/15 ([terms](https://buffer.com/api/commit/terms)). Delight is a separate award. Feasibility means one person, part-time, **Nov 5 → Nov 13**, within the shared app-client quota (~250 calls/day per the [handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8)).

## Overview

| # | Idea | User | Surface | Problem |
|---|---|---|---|---|
| 01 | [Legible](01-legible/README.md) | Comms teams, nonprofits, edu, gov | Next.js web app + Buffer Notes | Inaccessible posts (no alt text, fancy Unicode, emoji walls) slip into the queue |
| 02 | [Pressline](02-pressline/README.md) | WordPress editors and bloggers | WordPress plugin (Gutenberg) + OAuth broker | Turning an article into a correct multi-network campaign takes 30 min |
| 03 | [Shipnotes](03-shipnotes/README.md) | Indie devs, OSS, DevRel | GitHub App + dashboard | Releases go unannounced. CI can't safely hold a publish-capable key |
| 04 | [Snapline](04-snapline/README.md) | Local SMBs, field staff | Mobile PWA | Posting needs a desk, and the API needs you to host media yourself |
| 05 | [Sunday Reset](05-sunday-reset/README.md) | Solo daily posters | Weekly email + guided web ritual | Queues drift: gaps, failures, paused channels |

## Scoring

| Idea | Usefulness | Craft potential | Creativity | **Judged /15** | Delight | Feasibility (8 days) | API risk | **Total /25** |
|---|---|---|---|---|---|---|---|---|
| **01 Legible** | 4 | 5 | 5 | **14** | 5 | 4 | Med (`editPost` assets, Notes exp.) | **23** |
| 03 Shipnotes | 3 | 5 | 4 | 12 | 4 | 5 | Low | 21 |
| 04 Snapline | 5 | 4 | 4 | 13 | 5 | 3 | Med (GBP metadata deprecated, device APIs) | 21 |
| 05 Sunday Reset | 4 | 4 | 3 | 11 | 4 | 4 | Med (slot semantics, `movePostInQueue` exp.) | 19 |
| 02 Pressline | 4 | 4 | 3 | 11 | 4 | 2 | Med (judge access to WP admin, broker) | 17 |

### Score rationale

- **Legible:**
  - Unique in the ecosystem ([research §5](../research/buffer-commit-research.md#5-what-already-exists-dont-duplicate)).
  - The "Hear it" moment is the most memorable 10 seconds of any of the five demos.
  - Low call volume. It touches read, edit and Notes, which shows API depth.
  - Risk sits in one Day-1 spike (`editPost` with assets).
- **Shipnotes:**
  - Easiest to ship. It directly answers a [board request](https://suggestions.buffer.com/p/api-permissions-scopes) and dogfoods build-in-public.
  - The audience is narrower, which costs usefulness, and usefulness breaks ties.
- **Snapline:**
  - Most useful for Buffer's SMB base, and it solves the #1 open API request (media hosting).
  - Real-device camera, mic and PWA work plus GBP metadata flux make 8 days tight.
- **Sunday Reset:**
  - Solid and lovable, but judges may read it as "a nicer Buffer queue view". Creativity takes the hit.
- **Pressline:**
  - Your strongest skill set, but the space is crowded: WP to Buffer, Nelio, Evergreen.
  - Judges must log into a WP admin, and the broker adds an extra service. It's the least feasible and the least novel, so it's better as a post-contest product.

## Ranked recommendation

1. **🏆 Build 01 — Legible.** It has the highest judged score and the strongest Delight angle. It fits 8 part-time days comfortably, with Day 13 kept as slack. For getting noticed by Buffer, it shows product judgment (a real gap nobody covers), engineering care (rate-limit budget, safe edits, tests) and design craft (an accessible app about accessibility) in a 2-minute video.
2. **03 Shipnotes:** the fallback if the Day-1 `editPost`-with-assets spike fails. The Foundation code transfers 100%.
3. **04 Snapline:** the best idea for a longer timeline.
4. **05 Sunday Reset.**
5. **02 Pressline:** bring your WordPress depth to it *after* the contest. Your WP-VIP rigour still shows in Legible through its testing, standards and security write-up.

### Go/no-go gate (end of Day 1, Thu Nov 5)

Use `saveToDraft` test posts on X, LinkedIn and Bluesky:

- ✅ If `editPost` updates `assets[].image.metadata.altText` and keeps the image and schedule, build **Legible**.
- ❌ If it doesn't, switch to **Shipnotes** on Day 2. You lose nothing, because Day 1 is the shared foundation.

### Non-negotiables for whichever you build

- The submission uses a **private app client with OAuth + PKCE**, never a personal key ([handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8)).
- No metrics features, because app clients can't read them ([post metrics](https://developers.buffer.com/guides/post-metrics.html)).
- Design for about 250 calls/day shared with the judges. Email `developersupport@buffer.com` for headroom ([rate limits](https://developers.buffer.com/guides/api-limits.html)).
- The name and branding aren't Buffer's ([handbook](https://buffer.notion.site/Buffer-Commit-Developer-Handbook-3d7a7f5a00fd80918466e36eb2cba9f8)).
- **Submit by Nov 13, 10 PM BST.** The real deadline is Nov 14, 1:59 PM BST, and submissions can't be edited afterwards.
- Keep the app up and `main` frozen through **Dec 7**.
