import { emojiPattern } from "../rules/emoji";
import { FANCY_UNIT, spokenName } from "../rules/fancy";
import { EMOJI_NAMES } from "./emoji-names";

export type SpokenKind = "text" | "emoji" | "fancy" | "hashtag";

export interface SpokenSegment {
  kind: SpokenKind;
  /** The original characters. */
  source: string;
  /** What a screen reader would say for them. */
  spoken: string;
}

const SKIN_TONES: Record<string, string> = {
  "\u{1F3FB}": "light skin tone",
  "\u{1F3FC}": "medium-light skin tone",
  "\u{1F3FD}": "medium skin tone",
  "\u{1F3FE}": "medium-dark skin tone",
  "\u{1F3FF}": "dark skin tone",
};

export function emojiName(emoji: string): string {
  if (EMOJI_NAMES[emoji]) return EMOJI_NAMES[emoji];
  const tone = [...emoji].map((c) => SKIN_TONES[c]).find(Boolean);
  const base = emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "");
  const name = EMOJI_NAMES[base] ?? EMOJI_NAMES[base.replace(/\uFE0F/g, "")] ?? EMOJI_NAMES[base + "\uFE0F"];
  if (name) return tone ? `${name}: ${tone}` : name;
  return "emoji";
}

const OTHER_TOKEN = new RegExp(`(${FANCY_UNIT.source})|(#[\\p{L}\\p{N}_]+)`, "gu");

interface Token {
  index: number;
  value: string;
  kind: Exclude<SpokenKind, "text">;
}

/**
 * emoji-regex is a non-Unicode-mode regex (it matches surrogate pairs), so it
 * can't be merged into one `u` regex. Collect matches from both and merge,
 * giving emoji priority on overlap.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(emojiPattern())) tokens.push({ index: m.index, value: m[0], kind: "emoji" });
  const taken = tokens.map((t) => [t.index, t.index + t.value.length] as const);
  for (const m of text.matchAll(OTHER_TOKEN)) {
    const start = m.index;
    const end = start + m[0].length;
    if (taken.some(([a, b]) => start < b && end > a)) continue;
    tokens.push({ index: start, value: m[0], kind: m[1] ? "fancy" : "hashtag" });
  }
  return tokens.sort((a, b) => a.index - b.index);
}

/**
 * Split text into segments with what a verbose screen reader announces for each.
 * Emoji become their CLDR names, styled Unicode letters become symbol names,
 * everything else is read as written.
 */
export function toSpokenSegments(text: string): SpokenSegment[] {
  const segments: SpokenSegment[] = [];
  let cursor = 0;
  const pushText = (s: string) => {
    if (!s) return;
    const last = segments[segments.length - 1];
    if (last?.kind === "text") {
      last.source += s;
      last.spoken += s;
    } else segments.push({ kind: "text", source: s, spoken: s });
  };
  for (const token of tokenize(text)) {
    const gap = text.slice(cursor, token.index);
    pushText(gap);
    const { value } = token;
    if (token.kind === "emoji") {
      segments.push({ kind: "emoji", source: value, spoken: emojiName(value) });
    } else if (token.kind === "fancy") {
      const last = segments[segments.length - 1];
      const name = spokenName(value);
      if (last?.kind === "fancy" && gap === "") {
        last.source += value;
        last.spoken += `, ${name}`;
      } else segments.push({ kind: "fancy", source: value, spoken: name });
    } else {
      // A screen reader says "hashtag", then tries the body as a single word.
      segments.push({ kind: "hashtag", source: value, spoken: `hashtag ${value.slice(1)}` });
    }
    cursor = token.index + value.length;
  }
  pushText(text.slice(cursor));
  return segments;
}

/** A single string suitable for speechSynthesis. */
export function toSpokenText(text: string): string {
  return toSpokenSegments(text)
    .map((s) => (s.kind === "text" ? s.spoken : ` ${s.spoken}, `))
    .join("")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Alt text is announced as "image, <alt>" or just "image". */
export function spokenImage(altText: string): string {
  const alt = altText.trim();
  return alt ? `Image: ${alt}.` : "Image.";
}
