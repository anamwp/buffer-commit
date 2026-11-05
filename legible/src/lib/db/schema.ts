import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  bufferAccountId: text("buffer_account_id").notNull().unique(),
  email: text("email"),
  name: text("name"),
  timezone: text("timezone"),
  /** Cached `account.organizations` ({id,name}[]). */
  organizations: jsonb("organizations").$type<{ id: string; name: string }[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connections = pgTable("connections", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope").notNull(),
  /** Short lease so only one request refreshes a rotating refresh token at a time. */
  refreshLeaseUntil: timestamp("refresh_lease_until", { withTimezone: true }),
  needsReauth: boolean("needs_reauth").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export interface CachedChannel {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  avatar: string;
  timezone: string;
  isDisconnected: boolean;
  isQueuePaused: boolean;
}

export const channelCache = pgTable(
  "channel_cache",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull(),
    channels: jsonb("channels").$type<CachedChannel[]>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export interface SnapshotAsset {
  type: "image" | "video" | "document";
  source: string;
  thumbnail: string;
  altText?: string;
  userTags?: { handle: string; x: number; y: number }[];
  thumbnailOffset?: number | null;
  title?: string | null;
}

export const postSnapshots = pgTable(
  "post_snapshots",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id").notNull(),
    orgId: text("org_id").notNull(),
    channelId: text("channel_id").notNull(),
    service: text("service").notNull(),
    status: text("status").notNull(),
    isThread: boolean("is_thread").notNull().default(false),
    text: text("text").notNull(),
    assets: jsonb("assets").$type<SnapshotAsset[]>().notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    score: integer("score").notNull(),
    findingCount: integer("finding_count").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("post_snapshots_org").on(t.userId, t.orgId)],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    postCount: integer("post_count").notNull(),
    issueCount: integer("issue_count").notNull(),
    score: integer("score").notNull(),
    truncated: boolean("truncated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scans_user_org").on(t.userId, t.orgId, t.createdAt)],
);

/** Activity log: fixes applied and notes left, for the "fixed" counters and audit. */
export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  postId: text("post_id").notNull(),
  kind: text("kind").$type<"edit" | "note">().notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Last seen Buffer rate-limit state per window (shared by every user of the app client). */
export const apiBudget = pgTable("api_budget", {
  windowSeconds: integer("window_seconds").primaryKey(),
  quota: integer("quota").notNull(),
  remaining: integer("remaining").notNull(),
  resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
});
