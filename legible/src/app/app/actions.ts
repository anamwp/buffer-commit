"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/lib/db";
import { BufferApiError, BufferMutationError, RateLimitedError, ReauthRequiredError } from "@/lib/buffer/errors";
import {
  assertMutation,
  CREATE_NOTE_MUTATION,
  EDIT_POST_MUTATION,
  EDITABLE_STATUSES,
  isThread,
  POST_QUERY,
  rebuildAssets,
  type CreateNoteData,
  type EditPostData,
  type PostData,
} from "@/lib/buffer/operations";
import { AiUnavailableError, suggestFixes, type Suggestion } from "@/lib/server/ai";
import { bufferRequest } from "@/lib/server/buffer";
import { analyzeSnapshot, forRules, getSnapshot, runScan, ScanCooldownError, toSnapshotAssets } from "@/lib/server/scan";
import { getSession } from "@/lib/server/session";
import { requireUser } from "@/lib/server/user";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; reconnect?: boolean };

function friendly(err: unknown): { error: string; reconnect?: boolean } {
  if (err instanceof RateLimitedError) {
    const mins = Math.max(1, Math.ceil(err.retryAfterSeconds / 60));
    return { error: `Buffer needs a breather: the shared API quota (${err.window} window) resets in about ${mins} min.` };
  }
  if (err instanceof ReauthRequiredError) return { error: "Your Buffer connection has expired.", reconnect: true };
  if (err instanceof ScanCooldownError) return { error: err.message };
  if (err instanceof BufferMutationError) return { error: `Buffer said: ${err.message}` };
  if (err instanceof AiUnavailableError) return { error: err.message };
  if (err instanceof BufferApiError) {
    console.error("Buffer API error", err.message);
    return { error: "Buffer's API returned an error. Please try again in a moment." };
  }
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export async function selectOrgAction(formData: FormData) {
  const { user, session } = await requireUser();
  const orgId = String(formData.get("orgId") ?? "");
  if (user.organizations.some((o) => o.id === orgId)) {
    session.orgId = orgId;
    await session.save();
  }
  revalidatePath("/app");
}

export async function scanAction(): Promise<ActionResult> {
  const { user, orgId } = await requireUser();
  if (!orgId) return { ok: false, error: "No Buffer organization found on this account." };
  try {
    await runScan(user.id, orgId);
    revalidatePath("/app");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, ...friendly(err) };
  }
}

export async function suggestAction(postId: string): Promise<ActionResult<Suggestion>> {
  const { user } = await requireUser();
  const snap = await getSnapshot(user.id, postId);
  if (!snap) return { ok: false, error: "Post not found. Run a new scan." };
  const { findings } = analyzeSnapshot(snap);
  try {
    const suggestion = await suggestFixes({ ...forRules(snap), findings });
    return { ok: true, data: suggestion };
  } catch (err) {
    return { ok: false, ...friendly(err) };
  }
}

export interface ApplyInput {
  postId: string;
  /** The text the user reviewed and approved. */
  text: string;
  /** assetIndex -> new alt text. */
  altTexts: Record<number, string>;
  aiAssisted: boolean;
}

export interface ApplyResult {
  score: number;
  findingCount: number;
  changed: { text: boolean; altTexts: number };
}

/**
 * Apply a reviewed fix with editPost. Before writing, re-read the post (one
 * call) so a newer edit made in Buffer is never overwritten, and only send the
 * fields that changed. `mode` is omitted so the schedule is untouched.
 */
export async function applyFixAction(input: ApplyInput): Promise<ActionResult<ApplyResult>> {
  const { user } = await requireUser();
  const snap = await getSnapshot(user.id, input.postId);
  if (!snap) return { ok: false, error: "Post not found. Run a new scan." };

  try {
    const { post: live } = await bufferRequest<PostData>(user.id, POST_QUERY, { id: input.postId });
    if (!EDITABLE_STATUSES.has(live.status)) {
      return { ok: false, error: `This post is now "${live.status}" in Buffer and can no longer be edited.` };
    }
    if (isThread(live)) {
      return { ok: false, error: "This is a thread. Legible doesn't edit threads yet; leave a Note for the author instead." };
    }
    if ((live.text ?? "") !== snap.text) {
      await refreshSnapshot(user.id, live);
      return { ok: false, error: "Someone edited this post in Buffer since your scan. Legible reloaded it; please review again." };
    }

    const textChanged = input.text !== snap.text;
    const altChanges = Object.fromEntries(
      Object.entries(input.altTexts)
        .map(([k, v]) => [Number(k), v.trim()] as const)
        .filter(([i, v]) => live.assets[i]?.type === "image" && v && v !== (live.assets[i].image?.altText ?? "")),
    ) as Record<number, string>;
    const altCount = Object.keys(altChanges).length;
    if (!textChanged && altCount === 0) return { ok: false, error: "Nothing to change." };

    const editInput: Record<string, unknown> = { id: input.postId };
    if (textChanged) editInput.text = input.text;
    if (altCount) editInput.assets = rebuildAssets(live.assets, altChanges);
    if (input.aiAssisted) editInput.aiAssisted = true;

    const result = await bufferRequest<EditPostData>(user.id, EDIT_POST_MUTATION, { input: editInput });
    const success = assertMutation(result.editPost, "PostActionSuccess");
    const updated = success.post ?? live;
    const { score, findingCount } = await refreshSnapshot(user.id, updated);

    const db = await getDb();
    await db.insert(schema.actions).values({
      userId: user.id,
      postId: input.postId,
      kind: "edit",
      before: { text: snap.text, altTexts: Object.fromEntries(Object.keys(altChanges).map((i) => [i, live.assets[Number(i)].image?.altText ?? ""])) },
      after: { text: textChanged ? input.text : undefined, altTexts: altChanges },
    });
    revalidatePath("/app");
    revalidatePath(`/app/posts/${input.postId}`);
    return { ok: true, data: { score, findingCount, changed: { text: textChanged, altTexts: altCount } } };
  } catch (err) {
    return { ok: false, ...friendly(err) };
  }
}

async function refreshSnapshot(userId: string, post: PostData["post"]) {
  const db = await getDb();
  const assets = toSnapshotAssets(post);
  const { findings, score } = analyzeSnapshot({ text: post.text ?? "", service: post.channelService, assets });
  await db
    .update(schema.postSnapshots)
    .set({
      text: post.text ?? "",
      assets,
      status: post.status,
      isThread: isThread(post),
      dueAt: post.dueAt ? new Date(post.dueAt) : null,
      score,
      findingCount: findings.length,
      fetchedAt: new Date(),
    })
    .where(and(eq(schema.postSnapshots.userId, userId), eq(schema.postSnapshots.postId, post.id)));
  return { score, findingCount: findings.length };
}

/** Leave a Buffer Note on the post so the author sees the issues inside Buffer. */
export async function leaveNoteAction(postId: string, text: string): Promise<ActionResult> {
  const { user } = await requireUser();
  const body = text.trim().slice(0, 2000);
  if (!body) return { ok: false, error: "The note is empty." };
  try {
    const result = await bufferRequest<CreateNoteData>(user.id, CREATE_NOTE_MUTATION, {
      input: { subject: { postId }, text: body },
    });
    assertMutation(result.createCollaborationNote, "CreateCollaborationNoteSuccess");
    const db = await getDb();
    await db.insert(schema.actions).values({ userId: user.id, postId, kind: "note", after: { text: body } });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, ...friendly(err) };
  }
}

/** Disconnect: delete every row for this user (tokens, snapshots, history) and sign out. */
export async function deleteMyDataAction() {
  const session = await getSession();
  if (session.userId) {
    const db = await getDb();
    await db.delete(schema.users).where(eq(schema.users.id, session.userId));
  }
  session.destroy();
  redirect("/?deleted=1");
}
