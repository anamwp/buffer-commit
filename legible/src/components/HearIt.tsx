"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { spokenImage, toSpokenSegments, toSpokenText, type SpokenSegment } from "@/lib/speech";

interface Props {
  text: string;
  images?: { altText: string }[];
  label: string;
  tone?: "before" | "after";
  /** Show the "what the screen reader says" transcript. */
  showTranscript?: boolean;
}

const SEGMENT_STYLE: Record<SpokenSegment["kind"], string> = {
  text: "",
  emoji: "bg-medium-soft text-medium rounded px-1",
  fancy: "bg-high-soft text-high rounded px-1",
  hashtag: "bg-low-soft text-low rounded px-1",
};

let activeStop: (() => void) | null = null;

export function HearIt({ text, images = [], label, tone = "before", showTranscript = true }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  const segments = useMemo(() => toSpokenSegments(text), [text]);
  const spoken = useMemo(
    () => [toSpokenText(text), ...images.map((img) => spokenImage(img.altText))].join(" "),
    [text, images],
  );

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (utterance.current) window.speechSynthesis?.cancel();
    };
  }, []);

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function play() {
    if (speaking) return stop();
    activeStop?.();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = 1.05;
    u.lang = document.documentElement.lang || "en";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterance.current = u;
    activeStop = stop;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  const buttonTone =
    tone === "after"
      ? "bg-good text-white hover:opacity-90"
      : "bg-brand text-brand-ink hover:opacity-90";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={play}
        disabled={!supported || !text.trim()}
        aria-pressed={speaking}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonTone} ${speaking ? "speaking" : ""}`}
      >
        <span aria-hidden="true">{speaking ? "■" : "▶"}</span>
        {speaking ? "Stop" : label}
      </button>
      {!supported && (
        <p className="text-sm text-ink-2">Your browser can&apos;t speak aloud. The transcript below shows what a screen reader announces.</p>
      )}
      {showTranscript && (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-2">What a screen reader says</p>
          <p className="whitespace-pre-wrap leading-relaxed">
            {segments.map((s, i) =>
              s.kind === "text" ? (
                <span key={i}>{s.spoken}</span>
              ) : (
                <span key={i} className={SEGMENT_STYLE[s.kind]}>
                  {s.spoken}
                </span>
              ),
            )}
            {images.map((img, i) => (
              <span key={`img-${i}`} className={img.altText.trim() ? "" : "bg-high-soft text-high rounded px-1"}>
                {" "}
                {spokenImage(img.altText)}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
