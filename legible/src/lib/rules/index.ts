import { findEmoji, findEmojiRuns } from "./emoji";
import { findFancyRuns, toPlain } from "./fancy";
import { camelCaseSuggestion, HASHTAG, type Dictionary } from "./hashtags";
import type { Finding, PostForRules, Severity } from "./types";

export * from "./types";
export { createDictionary, type Dictionary } from "./hashtags";

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 25, medium: 10, low: 4 };
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** UTF-16 code units: what Buffer counts against most networks' limits. */
export function utf16Length(text: string): number {
  return text.length;
}

const WEAK_ALT = [
  /^(img|image|photo|picture|pic|dsc|dscn|screenshot|screen shot|untitled|graphic|banner)[\s_-]*\d*$/i,
  /\.(jpe?g|png|gif|webp|heic|avif)$/i,
  /^[\w-]+_\d{3,}$/i,
];
const REDUNDANT_ALT_PREFIX = /^(an? )?(image|picture|photo|photograph|graphic) (of|showing)\b/i;

function altTextFindings(post: PostForRules): Finding[] {
  const out: Finding[] = [];
  for (const image of post.images) {
    const alt = image.altText.trim();
    const n = image.assetIndex + 1;
    if (!alt) {
      out.push({
        rule: "alt-missing",
        severity: "high",
        title: `Image ${n} has no alt text`,
        detail:
          "People using screen readers hear nothing (or just \"image\") for this picture. Describe what it shows and why it matters to the post.",
        assetIndex: image.assetIndex,
        fix: { kind: "altText", assetIndex: image.assetIndex },
      });
    } else if (alt.length < 10 || WEAK_ALT.some((re) => re.test(alt))) {
      out.push({
        rule: "alt-weak",
        severity: "medium",
        title: `Image ${n} has placeholder alt text`,
        detail: `"${alt}" doesn't describe the image. Replace it with a short description of what's visible.`,
        assetIndex: image.assetIndex,
        fix: { kind: "altText", assetIndex: image.assetIndex },
      });
    } else if (REDUNDANT_ALT_PREFIX.test(alt)) {
      out.push({
        rule: "alt-weak",
        severity: "low",
        title: `Image ${n} alt text starts with "${alt.match(REDUNDANT_ALT_PREFIX)![0]}"`,
        detail: "Screen readers already announce it as an image, so this prefix is read twice. Start with the content.",
        assetIndex: image.assetIndex,
        fix: { kind: "altText", assetIndex: image.assetIndex },
      });
    }
  }
  return out;
}

function fancyFindings(text: string): Finding[] {
  return findFancyRuns(text).map((run) => {
    const plain = toPlain(run.value);
    const extra = run.value.length - plain.length;
    return {
      rule: "fancy-unicode" as const,
      severity: "high" as const,
      title: `Styled text "${plain.length > 40 ? plain.slice(0, 37) + "…" : plain}" is unreadable to screen readers`,
      detail:
        "These look-alike Unicode letters are read as symbol names or skipped entirely." +
        (extra > 0 ? ` They also cost ${extra} extra characters against the network's limit.` : ""),
      span: { start: run.start, end: run.end },
      fix: { kind: "replaceText" as const, span: { start: run.start, end: run.end }, replacement: plain },
    };
  });
}

function hashtagFindings(text: string, dict: Dictionary): Finding[] {
  const out: Finding[] = [];
  const tags = [...text.matchAll(HASHTAG)];
  for (const m of tags) {
    const body = m[0].slice(1);
    const suggestion = camelCaseSuggestion(body, dict);
    if (!suggestion) continue;
    const span = { start: m.index, end: m.index + m[0].length };
    out.push({
      rule: "hashtag-case",
      severity: "medium",
      title: `#${body} → #${suggestion}`,
      detail: "Capitalising each word lets screen readers pronounce the words instead of one long jumble, and helps everyone read it.",
      span,
      fix: { kind: "replaceText", span, replacement: `#${suggestion}` },
    });
  }
  if (tags.length > 5) {
    out.push({
      rule: "hashtag-overload",
      severity: "low",
      title: `${tags.length} hashtags`,
      detail: "Each hashtag is read aloud in full. Keep it to a few that matter, ideally at the end of the post.",
    });
  }
  return out;
}

function emojiFindings(text: string): Finding[] {
  const out: Finding[] = [];
  for (const run of findEmojiRuns(text)) {
    out.push({
      rule: "emoji-run",
      severity: "medium",
      title: `${run.items.length} emoji in a row`,
      detail: "Screen readers announce every emoji by name, one after another. One is usually enough.",
      span: { start: run.start, end: run.end },
      fix: { kind: "replaceText", span: { start: run.start, end: run.end }, replacement: run.items[0].value },
    });
  }
  const total = findEmoji(text).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (total >= 8 && total / Math.max(words, 1) > 0.15) {
    out.push({
      rule: "emoji-density",
      severity: "low",
      title: `${total} emoji in ${words} words`,
      detail: "Heavy emoji use makes posts slow and tiring to listen to. Keep the ones that add meaning.",
    });
  }
  return out;
}

function capsFindings(text: string): Finding[] {
  const out: Finding[] = [];
  // 3+ consecutive all-caps words of 2+ letters (short acronyms alone are fine).
  const re = /\b\p{Lu}{2,}(?:[\s,!.?'’-]+\p{Lu}{2,}){2,}\b/gu;
  for (const m of text.matchAll(re)) {
    const letters = m[0].replace(/[^\p{L}]/gu, "");
    if (letters.length < 10) continue;
    out.push({
      rule: "caps-run",
      severity: "low",
      title: "Long run of capital letters",
      detail: "All-caps text is harder to read (especially for people with dyslexia), and some screen readers spell it out letter by letter.",
      span: { start: m.index, end: m.index + m[0].length },
    });
  }
  return out;
}

export function analyzePost(post: PostForRules, dict: Dictionary): Finding[] {
  const findings = [
    ...altTextFindings(post),
    ...fancyFindings(post.text),
    ...hashtagFindings(post.text, dict),
    ...emojiFindings(post.text),
    ...capsFindings(post.text),
  ];
  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.span?.start ?? -1) - (b.span?.start ?? -1),
  );
}

/** 0-100. Each finding subtracts a weight by severity. */
export function scorePost(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return Math.max(0, 100 - penalty);
}

export function scoreMany(scores: number[]): number {
  if (scores.length === 0) return 100;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Apply every deterministic text fix (non-overlapping, right to left so earlier
 * indices stay valid).
 */
export function applyTextFixes(text: string, findings: Finding[]): string {
  const fixes = findings
    .map((f) => f.fix)
    .filter((f): f is Extract<NonNullable<Finding["fix"]>, { kind: "replaceText" }> => f?.kind === "replaceText")
    .sort((a, b) => b.span.start - a.span.start);
  let out = text;
  let lastStart = Infinity;
  for (const fix of fixes) {
    if (fix.span.end > lastStart) continue; // overlapping: keep the later one
    out = out.slice(0, fix.span.start) + fix.replacement + out.slice(fix.span.end);
    lastStart = fix.span.start;
  }
  return out;
}
