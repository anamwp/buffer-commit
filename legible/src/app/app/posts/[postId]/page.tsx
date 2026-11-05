import Link from "next/link";
import { notFound } from "next/navigation";
import { PostFixer } from "@/components/PostFixer";
import { serviceLabel } from "@/components/services";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { EDITABLE_STATUSES } from "@/lib/buffer/operations";
import { aiEnabled } from "@/lib/server/env";
import { analyzeSnapshot, getSnapshot } from "@/lib/server/scan";
import { requireUser } from "@/lib/server/user";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const { user } = await requireUser();
  const snap = await getSnapshot(user.id, postId);
  if (!snap) notFound();
  const { findings } = analyzeSnapshot(snap);
  const images = snap.assets
    .map((a, assetIndex) => ({ a, assetIndex }))
    .filter(({ a }) => a.type === "image")
    .map(({ a, assetIndex }) => ({ assetIndex, url: a.source, thumbnail: a.thumbnail, altText: a.altText ?? "" }));

  return (
    <>
      <SiteHeader signedIn />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <Link href="/app" className="text-sm font-bold text-brand">
          ← Back to queue
        </Link>
        <h1 className="mt-3 text-3xl font-bold">
          {serviceLabel(snap.service)} post
          <span className="ml-3 align-middle text-base font-normal text-ink-2">
            {snap.dueAt ? `Scheduled ${snap.dueAt.toLocaleString("en")}` : snap.status === "draft" ? "Draft" : snap.status}
          </span>
        </h1>
        <div className="mt-6">
          <PostFixer
            postId={snap.postId}
            service={snap.service}
            text={snap.text}
            images={images}
            initialFindings={findings}
            editable={EDITABLE_STATUSES.has(snap.status)}
            isThread={snap.isThread}
            aiEnabled={aiEnabled()}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
