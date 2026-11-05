"use client";

import { useMemo, useState } from "react";
import { applyTextFixes, scorePost } from "@/lib/rules";
import { HearIt } from "./HearIt";
import { Highlighted, SeverityBadge } from "./Highlighted";
import { ScoreRing } from "./ScoreRing";
import { useAnalyzer } from "./useAnalyzer";

const EXAMPLE = "🚀🚀🚀 𝐁𝐢𝐠 𝐧𝐞𝐰𝐬: our new course is LIVE TODAY ONLY!!! 🔥🔥🔥\n\nSign up now 👉 link in bio #smallbusinessowner #socialmediatips";

export function Playground() {
  const [text, setText] = useState(EXAMPLE);
  const [hasImage, setHasImage] = useState(true);
  const [alt, setAlt] = useState("");
  const { ready, analyze } = useAnalyzer();

  const post = useMemo(
    () => ({
      text,
      service: "linkedin",
      images: hasImage ? [{ assetIndex: 0, url: "", altText: alt }] : [],
    }),
    [text, hasImage, alt],
  );
  const findings = ready ? analyze(post) : [];
  const score = scorePost(findings);
  const fixed = applyTextFixes(text, findings);
  const canFix = fixed !== text;

  return (
    <section aria-labelledby="try-heading" className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="try-heading" className="text-2xl font-bold">
            Try it on any post
          </h2>
          <p className="mt-1 text-ink-2">No sign-in needed. Paste a post, then press play.</p>
        </div>
        <ScoreRing score={ready ? score : 100} />
      </div>

      <label htmlFor="post-text" className="mt-6 block text-sm font-bold">
        Post text
      </label>
      <textarea
        id="post-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="mt-2 w-full rounded-xl border border-line bg-bg p-3 text-base leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasImage} onChange={(e) => setHasImage(e.target.checked)} className="h-4 w-4" />
          Post has an image
        </label>
        {hasImage && (
          <label className="flex min-w-60 flex-1 items-center gap-2 text-sm">
            <span className="shrink-0 font-bold">Alt text</span>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="(empty)"
              className="w-full rounded-lg border border-line bg-bg px-3 py-1.5"
            />
          </label>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 font-bold">As written</h3>
          <HearIt text={text} images={post.images} label="Hear it" />
        </div>
        <div>
          <h3 className="mb-3 font-bold">With Legible&apos;s fixes</h3>
          <HearIt text={fixed} images={post.images} label="Hear the fix" tone="after" />
          <button
            type="button"
            disabled={!canFix}
            onClick={() => setText(fixed)}
            className="mt-3 rounded-full border border-line px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            Apply text fixes
          </button>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-bold">
          {ready ? `${findings.length} ${findings.length === 1 ? "issue" : "issues"} found` : "Loading checks…"}
        </h3>
        <div className="mt-3 rounded-xl border border-line bg-bg p-4">
          <Highlighted text={text} findings={findings} />
        </div>
        <ul className="mt-4 space-y-3" aria-live="polite">
          {findings.map((f, i) => (
            <li key={`${f.rule}-${i}`} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={f.severity} />
                <span className="font-bold">{f.title}</span>
              </div>
              <p className="mt-1 text-sm text-ink-2">{f.detail}</p>
            </li>
          ))}
          {ready && findings.length === 0 && (
            <li className="rounded-xl bg-good-soft p-4 font-bold text-good">This post reads cleanly. Nice.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
