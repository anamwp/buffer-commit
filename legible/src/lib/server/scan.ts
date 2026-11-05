import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { CachedChannel, SnapshotAsset } from "../db/schema";
import { CHANNELS_QUERY, isThread, SCAN_QUERY, type ApiPost, type ChannelData, type ScanData } from "../buffer/operations";
import { analyzePost, scoreMany, scorePost, type Finding, type PostForRules } from "../rules";
import { getDictionary } from "../rules/dictionary";
import { bufferRequest } from "./buffer";

export const SCAN_WINDOW_DAYS = 14;
export const SCAN_COOLDOWN_MS = 5 * 60_000;
const CHANNEL_TTL_MS = 30 * 60_000;

export function toSnapshotAssets(post: ApiPost): SnapshotAsset[] {
  return post.assets.map((a) => ({
    type: a.type,
    source: a.source,
    thumbnail: a.thumbnail,
    altText: a.image?.altText ?? undefined,
    userTags: a.image?.userTags ?? undefined,
    thumbnailOffset: a.video?.thumbnailOffset ?? null,
    title: a.video?.title ?? a.document?.title ?? null,
  }));
}

export function forRules(snapshot: { text: string; service: string; assets: SnapshotAsset[] }): PostForRules {
  return {
    text: snapshot.text,
    service: snapshot.service,
    images: snapshot.assets
      .map((a, assetIndex) => ({ a, assetIndex }))
      .filter(({ a }) => a.type === "image")
      .map(({ a, assetIndex }) => ({ assetIndex, url: a.source, altText: a.altText ?? "" })),
  };
}

export function analyzeSnapshot(snapshot: { text: string; service: string; assets: SnapshotAsset[] }): {
  findings: Finding[];
  score: number;
} {
  const findings = analyzePost(forRules(snapshot), getDictionary());
  return { findings, score: scorePost(findings) };
}

export async function getChannels(userId: string, orgId: string, force = false): Promise<CachedChannel[]> {
  const db = await getDb();
  if (!force) {
    const [cached] = await db
      .select()
      .from(schema.channelCache)
      .where(and(eq(schema.channelCache.userId, userId), eq(schema.channelCache.orgId, orgId)));
    if (cached && Date.now() - cached.fetchedAt.getTime() < CHANNEL_TTL_MS) return cached.channels;
  }
  const data = await bufferRequest<{ channels: ChannelData[] }>(userId, CHANNELS_QUERY, { organizationId: orgId });
  const channels: CachedChannel[] = data.channels.map((c) => ({
    id: c.id,
    name: c.name,
    displayName: c.displayName,
    service: c.service,
    avatar: c.avatar,
    timezone: c.timezone,
    isDisconnected: c.isDisconnected,
    isQueuePaused: c.isQueuePaused,
  }));
  const row = { userId, orgId, channels, fetchedAt: new Date() };
  await db
    .insert(schema.channelCache)
    .values(row)
    .onConflictDoUpdate({ target: [schema.channelCache.userId, schema.channelCache.orgId], set: row });
  return channels;
}

export async function latestScan(userId: string, orgId: string) {
  const db = await getDb();
  const [scan] = await db
    .select()
    .from(schema.scans)
    .where(and(eq(schema.scans.userId, userId), eq(schema.scans.orgId, orgId)))
    .orderBy(desc(schema.scans.createdAt))
    .limit(1);
  return scan ?? null;
}

export class ScanCooldownError extends Error {
  constructor(readonly retryInSeconds: number) {
    super(`You scanned a moment ago. Try again in ${Math.ceil(retryInSeconds / 60)} min.`);
  }
}

/**
 * Scan the next 14 days of scheduled/awaiting-approval posts plus recent
 * drafts. One Buffer API call (two aliased connections), plus a cached
 * channels call. Results are stored as snapshots; findings are recomputed from
 * snapshots on demand because the rules are deterministic and cheap.
 */
export async function runScan(userId: string, orgId: string) {
  const db = await getDb();
  const previous = await latestScan(userId, orgId);
  if (previous && Date.now() - previous.createdAt.getTime() < SCAN_COOLDOWN_MS) {
    throw new ScanCooldownError((SCAN_COOLDOWN_MS - (Date.now() - previous.createdAt.getTime())) / 1000);
  }

  await getChannels(userId, orgId);
  const windowStart = new Date();
  const windowEnd = new Date(windowStart.getTime() + SCAN_WINDOW_DAYS * 86_400_000);
  const data = await bufferRequest<ScanData>(userId, SCAN_QUERY, {
    organizationId: orgId,
    start: windowStart.toISOString(),
    end: windowEnd.toISOString(),
  });

  const byId = new Map<string, ApiPost>();
  for (const edge of [...(data.upcoming.edges ?? []), ...(data.drafts.edges ?? [])]) byId.set(edge.node.id, edge.node);
  const posts = [...byId.values()];

  const rows = posts.map((p) => {
    const assets = toSnapshotAssets(p);
    const { findings, score } = analyzeSnapshot({ text: p.text ?? "", service: p.channelService, assets });
    return {
      userId,
      postId: p.id,
      orgId,
      channelId: p.channelId,
      service: p.channelService,
      status: p.status,
      isThread: isThread(p),
      text: p.text ?? "",
      assets,
      dueAt: p.dueAt ? new Date(p.dueAt) : null,
      score,
      findingCount: findings.length,
      fetchedAt: new Date(),
    };
  });

  await db.delete(schema.postSnapshots).where(and(eq(schema.postSnapshots.userId, userId), eq(schema.postSnapshots.orgId, orgId)));
  if (rows.length) await db.insert(schema.postSnapshots).values(rows);

  const [scan] = await db
    .insert(schema.scans)
    .values({
      userId,
      orgId,
      windowStart,
      windowEnd,
      postCount: rows.length,
      issueCount: rows.reduce((n, r) => n + r.findingCount, 0),
      score: scoreMany(rows.map((r) => r.score)),
      truncated: data.upcoming.pageInfo.hasNextPage || data.drafts.pageInfo.hasNextPage,
    })
    .returning();
  return scan;
}

export async function getSnapshots(userId: string, orgId: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.postSnapshots)
    .where(and(eq(schema.postSnapshots.userId, userId), eq(schema.postSnapshots.orgId, orgId)));
}

export async function getSnapshot(userId: string, postId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.postSnapshots)
    .where(and(eq(schema.postSnapshots.userId, userId), eq(schema.postSnapshots.postId, postId)));
  return row ?? null;
}

/** Counts of fixes applied in the last 30 days (for the dashboard). */
export async function recentFixCount(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.actions.id })
    .from(schema.actions)
    .where(
      and(
        eq(schema.actions.userId, userId),
        eq(schema.actions.kind, "edit"),
        gt(schema.actions.createdAt, new Date(Date.now() - 30 * 86_400_000)),
      ),
    );
  return rows.length;
}
