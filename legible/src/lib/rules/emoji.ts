import emojiRegex from "emoji-regex";

export function emojiPattern(): RegExp {
  return emojiRegex();
}

export interface EmojiMatch {
  start: number;
  end: number;
  value: string;
}

export function findEmoji(text: string): EmojiMatch[] {
  const out: EmojiMatch[] = [];
  for (const m of text.matchAll(emojiPattern())) {
    out.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Groups of 3+ emoji separated only by spaces/tabs (not line breaks). */
export function findEmojiRuns(text: string, minLength = 3): { start: number; end: number; items: EmojiMatch[] }[] {
  const emoji = findEmoji(text);
  const runs: { start: number; end: number; items: EmojiMatch[] }[] = [];
  let current: EmojiMatch[] = [];
  const flush = () => {
    if (current.length >= minLength) {
      runs.push({ start: current[0].start, end: current[current.length - 1].end, items: current });
    }
    current = [];
  };
  for (const e of emoji) {
    const last = current[current.length - 1];
    if (last && /^[ \t]*$/.test(text.slice(last.end, e.start))) {
      current.push(e);
    } else {
      flush();
      current = [e];
    }
  }
  flush();
  return runs;
}
