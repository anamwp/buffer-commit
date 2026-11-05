import Link from "next/link";
import { BudgetMeter } from "@/components/BudgetMeter";
import { ScanButton } from "@/components/ScanButton";
import { ScoreRing } from "@/components/ScoreRing";
import { serviceLabel } from "@/components/services";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getBudget } from "@/lib/server/buffer";
import { analyzeSnapshot, getChannels, getSnapshots, latestScan, recentFixCount, SCAN_WINDOW_DAYS } from "@/lib/server/scan";
import { requireUser } from "@/lib/server/user";
import { scoreMany } from "@/lib/rules";
import { deleteMyDataAction, selectOrgAction } from "./actions";

export const dynamic = "force-dynamic";

function when(d: Date | null, status: string) {
  if (!d) return status === "draft" ? "Draft" : "Unscheduled";
  return d.toLocaleString("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function Dashboard() {
  const { user, orgId, needsReauth } = await requireUser();
  const [budget, scan, snapshots, fixes] = await Promise.all([
    getBudget(),
    orgId ? latestScan(user.id, orgId) : null,
    orgId ? getSnapshots(user.id, orgId) : [],
    recentFixCount(user.id),
  ]);
  let channels: Awaited<ReturnType<typeof getChannels>> = [];
  let channelError = false;
  if (orgId && scan) {
    try {
      channels = await getChannels(user.id, orgId);
    } catch {
      channelError = true;
    }
  }
  const channelById = new Map(channels.map((c) => [c.id, c]));

  const posts = snapshots
    .map((s) => ({ ...s, ...analyzeSnapshot(s) }))
    .sort((a, b) => a.score - b.score || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
  const flagged = posts.filter((p) => p.findings.length > 0);
  const overall = scoreMany(posts.map((p) => p.score));

  const byChannel = new Map<string, number[]>();
  for (const p of posts) byChannel.set(p.channelId, [...(byChannel.get(p.channelId) ?? []), p.score]);

  return (
    <>
      <SiteHeader signedIn />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {needsReauth && (
          <p role="alert" className="mb-6 rounded-xl bg-high-soft p-4 font-bold text-high">
            Your Buffer connection expired. <a href="/auth/buffer/start" className="underline">Reconnect Buffer</a>
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4 py-6">
          <div>
            <p className="text-ink-2">Signed in as {user.name || user.email}</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Your queue</h1>
          </div>
          {user.organizations.length > 1 && (
            <form action={selectOrgAction} className="flex items-center gap-2">
              <label htmlFor="org" className="text-sm font-bold">
                Organization
              </label>
              <select id="org" name="orgId" defaultValue={orgId ?? undefined} className="rounded-lg border border-line bg-surface px-3 py-2">
                {user.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <button className="rounded-full border border-line px-3 py-2 text-sm font-bold">Switch</button>
            </form>
          )}
        </div>

        {!orgId ? (
          <p className="rounded-xl bg-surface p-6">This Buffer account has no organizations yet.</p>
        ) : (
          <>
            <section className="grid gap-6 rounded-3xl border border-line bg-surface p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <ScoreRing score={scan ? overall : 100} size={132} label="Queue legibility score" />
              <div className="space-y-3">
                {scan ? (
                  <p className="text-lg">
                    <strong>{posts.length}</strong> posts checked, <strong>{flagged.length}</strong> need attention.
                    {fixes > 0 && <> You&apos;ve fixed <strong>{fixes}</strong> in the last 30 days.</>}
                    <span className="block text-sm text-ink-2">
                      Last scan {scan.createdAt.toLocaleString("en")}. Covers scheduled posts in the next {SCAN_WINDOW_DAYS} days and your
                      latest drafts.{scan.truncated && " Some posts were left out because the queue is very full."}
                    </span>
                  </p>
                ) : (
                  <p className="text-lg">Check your scheduled posts and drafts for accessibility issues. It takes one request to Buffer.</p>
                )}
                <ScanButton hasScan={Boolean(scan)} />
              </div>
            </section>

            {scan && byChannel.size > 0 && (
              <section aria-labelledby="channels-h" className="mt-8">
                <h2 id="channels-h" className="text-xl font-bold">
                  By channel
                </h2>
                {channelError && <p className="text-sm text-ink-2">Channel names are unavailable right now.</p>}
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...byChannel.entries()].map(([channelId, scores]) => {
                    const ch = channelById.get(channelId);
                    const post = posts.find((p) => p.channelId === channelId)!;
                    return (
                      <li key={channelId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                        <ScoreRing score={scoreMany(scores)} size={56} label={`${ch?.name ?? "Channel"} score`} />
                        <div className="min-w-0">
                          <p className="truncate font-bold">{ch?.displayName || ch?.name || "Channel"}</p>
                          <p className="text-sm text-ink-2">
                            {serviceLabel(ch?.service ?? post.service)} · {scores.length} {scores.length === 1 ? "post" : "posts"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {scan && (
              <section aria-labelledby="posts-h" className="mt-8">
                <h2 id="posts-h" className="text-xl font-bold">
                  {flagged.length ? "Posts to fix" : "Everything reads cleanly"}
                </h2>
                <ul className="mt-3 space-y-3">
                  {flagged.map((p) => {
                    const ch = channelById.get(p.channelId);
                    return (
                      <li key={p.postId}>
                        <Link
                          href={`/app/posts/${p.postId}`}
                          className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-brand"
                        >
                          <ScoreRing score={p.score} size={52} label="Post score" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink-2">
                              {ch?.name ?? serviceLabel(p.service)} · {serviceLabel(p.service)} · {when(p.dueAt, p.status)}
                            </p>
                            <p className="mt-1 line-clamp-2 break-words">{p.text || "(no text)"}</p>
                            <p className="mt-2 text-sm font-bold text-high">
                              {p.findings.length} {p.findings.length === 1 ? "issue" : "issues"}: {[...new Set(p.findings.map((f) => f.title))].slice(0, 2).join(" · ")}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <BudgetMeter budget={budget} />
          <form action={deleteMyDataAction} className="rounded-xl border border-line bg-surface p-3 text-sm">
            <p className="font-bold">Your data</p>
            <p className="mt-1 text-ink-2">Disconnecting deletes your Buffer tokens, scan results and history from Legible.</p>
            <button className="mt-2 rounded-full border border-high px-3 py-1.5 font-bold text-high">Disconnect &amp; delete my data</button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
