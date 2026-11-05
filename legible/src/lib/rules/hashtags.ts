/**
 * Hashtag helpers. Screen readers can only pronounce a multi-word hashtag
 * correctly when each word starts with a capital letter (#SmallBusinessOwner,
 * not #smallbusinessowner).
 */

export const HASHTAG = /#[\p{L}\p{N}_]+/gu;

export interface Dictionary {
  has(word: string): boolean;
}

export function createDictionary(words: string): Dictionary {
  const set = new Set(words.split(" "));
  return { has: (w) => set.has(w) };
}

const MAX_WORD = 24;

/**
 * Split an all-lowercase string into dictionary words, preferring the fewest
 * words. Returns null if no full segmentation exists.
 */
export function segment(input: string, dict: Dictionary): string[] | null {
  const s = input.toLowerCase();
  const n = s.length;
  // best[i] = fewest words covering s[0..i)
  const best: (number | null)[] = new Array(n + 1).fill(null);
  const prev: number[] = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - MAX_WORD); j < i; j++) {
      if (best[j] === null) continue;
      const piece = s.slice(j, i);
      const isNumber = /^\d+$/.test(piece);
      if (!isNumber && !dict.has(piece)) continue;
      const cost = best[j]! + 1;
      if (best[i] === null || cost < best[i]!) {
        best[i] = cost;
        prev[i] = j;
      }
    }
  }
  if (best[n] === null) return null;
  const parts: string[] = [];
  for (let i = n; i > 0; i = prev[i]) parts.unshift(s.slice(prev[i], i));
  return parts;
}

/**
 * Suggest a CamelCase version of a hashtag body (without '#'), or null if the
 * tag is already readable (mixed case, a single word, or not segmentable).
 */
export function camelCaseSuggestion(body: string, dict: Dictionary): string | null {
  const letters = body.replace(/[^\p{L}]/gu, "");
  if (letters.length < 6) return null;
  const isUniform = letters === letters.toLowerCase() || letters === letters.toUpperCase();
  if (!isUniform) return null;
  if (body.includes("_")) return null;
  const lower = body.toLowerCase();
  if (dict.has(lower)) return null;
  const parts = segment(lower, dict);
  if (!parts || parts.length < 2) return null;
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}
