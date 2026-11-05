"use client";

import { useMemo, useState, useTransition } from "react";
import { applyFixAction, leaveNoteAction, suggestAction } from "@/app/app/actions";
import { applyTextFixes, scorePost, type Finding } from "@/lib/rules";
import { HearIt } from "./HearIt";
import { Highlighted, SeverityBadge } from "./Highlighted";
import { ScoreRing } from "./ScoreRing";
import { useAnalyzer } from "./useAnalyzer";

interface Img {
  assetIndex: number;
  url: string;
  thumbnail: string;
  altText: string;
}

interface Props {
  postId: string;
  service: string;
  text: string;
  images: Img[];
  initialFindings: Finding[];
  editable: boolean;
  isThread: boolean;
  aiEnabled: boolean;
}

type Status = { kind: "idle" } | { kind: "ok"; message: string } | { kind: "error"; message: string; reconnect?: boolean };

export function PostFixer(props: Props) {
  const [original, setOriginal] = useState({ text: props.text, alts: props.images.map((i) => i.altText) });
  const [text, setText] = useState(props.text);
  const [alts, setAlts] = useState<string[]>(props.images.map((i) => i.altText));
  const [aiAssisted, setAiAssisted] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [noteStatus, setNoteStatus] = useState<Status>({ kind: "idle" });
  const [suggesting, startSuggest] = useTransition();
  const [applying, startApply] = useTransition();
  const [noting, startNote] = useTransition();
  const { ready, analyze } = useAnalyzer();

  const images = props.images.map((img, i) => ({ ...img, altText: alts[i] ?? "" }));
  const current = useMemo(
    () => ({ text, service: props.service, images: images.map(({ assetIndex, url, altText }) => ({ assetIndex, url, altText })) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, alts, props.service],
  );
  const findings = ready ? analyze(current) : props.initialFindings;
  const score = scorePost(findings);
  const dirty = text !== original.text || alts.some((a, i) => a.trim() !== (original.alts[i] ?? "").trim());
  const quickFixed = applyTextFixes(text, findings);
  const canEdit = props.editable && !props.isThread;

  const defaultNote = useMemo(
    () =>
      "Accessibility check from Legible:\n" +
      props.initialFindings.map((f) => `• ${f.title}`).join("\n") +
      "\n\nFixing these helps people using screen readers follow the post.",
    [props.initialFindings],
  );
  const [note, setNote] = useState(defaultNote);

  function suggest() {
    startSuggest(async () => {
      setStatus({ kind: "idle" });
      const res = await suggestAction(props.postId);
      if (!res.ok) return setStatus({ kind: "error", message: res.error, reconnect: res.reconnect });
      setText(res.data.rewrittenText);
      setAlts((prev) => {
        const next = [...prev];
        for (const a of res.data.altTexts) {
          const idx = props.images.findIndex((img) => img.assetIndex === a.assetIndex);
          if (idx >= 0) next[idx] = a.altText;
        }
        return next;
      });
      setAiAssisted(true);
      setAiSummary(res.data.summary);
    });
  }

  function apply() {
    startApply(async () => {
      const altTexts: Record<number, string> = {};
      images.forEach((img, i) => {
        if (alts[i].trim() !== (original.alts[i] ?? "").trim()) altTexts[img.assetIndex] = alts[i];
      });
      const res = await applyFixAction({ postId: props.postId, text, altTexts, aiAssisted });
      if (!res.ok) return setStatus({ kind: "error", message: res.error, reconnect: res.reconnect });
      setOriginal({ text, alts: [...alts] });
      const parts = [res.data.changed.text && "text", res.data.changed.altTexts && `${res.data.changed.altTexts} alt text`].filter(Boolean);
      setStatus({ kind: "ok", message: `Saved to Buffer: ${parts.join(" and ")} updated. The schedule is unchanged.` });
    });
  }

  function sendNote() {
    startNote(async () => {
      const res = await leaveNoteAction(props.postId, note);
      setNoteStatus(res.ok ? { kind: "ok", message: "Note added. The author will see it on this post in Buffer." } : { kind: "error", message: res.error, reconnect: res.reconnect });
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
        <section aria-labelledby="hear-h" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="hear-h" className="text-xl font-bold">
            Hear the difference
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-bold text-ink-2">In Buffer now</p>
              <HearIt text={original.text} images={original.alts.map((altText) => ({ altText }))} label="Hear it" />
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-ink-2">Your version</p>
              <HearIt text={text} images={alts.map((altText) => ({ altText }))} label="Hear your version" tone="after" />
            </div>
          </div>
        </section>

        <section aria-labelledby="edit-h" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="edit-h" className="text-xl font-bold">
              Fix it
            </h2>
            <div className="flex flex-wrap gap-2">
              {props.aiEnabled && canEdit && (
                <button
                  type="button"
                  onClick={suggest}
                  disabled={suggesting}
                  className="rounded-full border border-brand px-4 py-2 font-bold text-brand disabled:opacity-60"
                >
                  {suggesting ? "Thinking…" : "✦ Suggest fixes"}
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setText(quickFixed)}
                  disabled={quickFixed === text}
                  className="rounded-full border border-line px-4 py-2 font-bold disabled:opacity-40"
                >
                  Quick text fixes
                </button>
              )}
            </div>
          </div>
          {!canEdit && (
            <p className="mt-3 rounded-xl bg-medium-soft p-3 text-sm font-bold text-medium">
              {props.isThread
                ? "This is a thread. Legible doesn't edit threads yet, so leave a Note for the author instead."
                : "This post can't be edited any more (it may be publishing or already sent)."}
            </p>
          )}
          {aiSummary && (
            <p className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
              <strong>Suggested:</strong> {aiSummary} Review it before applying.
            </p>
          )}

          <label htmlFor="text" className="mt-5 block text-sm font-bold">
            Post text
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!canEdit}
            rows={Math.min(14, Math.max(4, text.split("\n").length + 1))}
            className="mt-2 w-full rounded-xl border border-line bg-bg p-3 leading-relaxed"
          />
          <div className="mt-3 rounded-xl border border-dashed border-line p-3 text-sm">
            <Highlighted text={text} findings={findings} />
          </div>

          {images.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="font-bold">Images</h3>
              {images.map((img, i) => (
                <div key={img.assetIndex} className="flex flex-col gap-3 sm:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumbnail || img.url}
                    alt={img.altText || ""}
                    className="h-28 w-28 shrink-0 rounded-xl border border-line object-cover"
                  />
                  <label className="flex-1 text-sm">
                    <span className="font-bold">Alt text for image {img.assetIndex + 1}</span>
                    <textarea
                      value={alts[i]}
                      disabled={!canEdit}
                      onChange={(e) => setAlts((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                      rows={3}
                      placeholder="Describe what's in the image"
                      className="mt-1 w-full rounded-xl border border-line bg-bg p-2"
                    />
                    <span className="text-ink-2">{alts[i].length} characters</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={apply}
                disabled={!dirty || applying}
                className="rounded-full bg-brand px-6 py-3 font-bold text-brand-ink disabled:opacity-50"
              >
                {applying ? "Saving to Buffer…" : "Apply to Buffer"}
              </button>
              {dirty && (
                <button
                  type="button"
                  onClick={() => {
                    setText(original.text);
                    setAlts([...original.alts]);
                    setAiAssisted(false);
                    setAiSummary(null);
                  }}
                  className="text-sm font-bold underline"
                >
                  Undo changes
                </button>
              )}
            </div>
          )}
          <StatusLine status={status} />
        </section>

        <section aria-labelledby="note-h" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="note-h" className="text-xl font-bold">
            Leave a Note in Buffer
          </h2>
          <p className="mt-1 text-sm text-ink-2">Not your post to change? Notes appear on the post inside Buffer for your teammates.</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            className="mt-3 w-full rounded-xl border border-line bg-bg p-3 text-sm"
            aria-label="Note text"
          />
          <button
            type="button"
            onClick={sendNote}
            disabled={noting || noteStatus.kind === "ok"}
            className="mt-3 rounded-full border border-line px-4 py-2 font-bold disabled:opacity-50"
          >
            {noting ? "Adding note…" : noteStatus.kind === "ok" ? "Note added ✓" : "Add note"}
          </button>
          <StatusLine status={noteStatus} />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Issues">
        <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5">
          <ScoreRing score={score} size={88} label="Post legibility score" />
          <p className="text-sm text-ink-2">
            {findings.length === 0 ? "No issues left." : `${findings.length} ${findings.length === 1 ? "issue" : "issues"} left`}
          </p>
        </div>
        <ul className="space-y-3" aria-live="polite">
          {findings.map((f, i) => (
            <li key={`${f.rule}-${i}`} className="rounded-2xl border border-line bg-surface p-4">
              <SeverityBadge severity={f.severity} />
              <p className="mt-2 font-bold">{f.title}</p>
              <p className="mt-1 text-sm text-ink-2">{f.detail}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  return (
    <p role={status.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm font-bold ${status.kind === "ok" ? "text-good" : "text-high"}`}>
      {status.message}{" "}
      {status.kind === "error" && status.reconnect && (
        <a href="/auth/buffer/start" className="underline">
          Reconnect Buffer
        </a>
      )}
    </p>
  );
}
