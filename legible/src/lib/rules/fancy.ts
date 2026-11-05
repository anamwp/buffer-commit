/**
 * "Fancy" text: look-alike Unicode letters (mathematical bold/italic/script,
 * fullwidth, circled, squared, small caps, combining strike/underline).
 * Screen readers either skip these or read each one as a symbol name, and Buffer
 * counts most of them as 2 UTF-16 units against character limits.
 */

const SMALL_CAPS: Record<string, string> = {
  ᴀ: "a", ʙ: "b", ᴄ: "c", ᴅ: "d", ᴇ: "e", ꜰ: "f", ɢ: "g", ʜ: "h", ɪ: "i", ᴊ: "j",
  ᴋ: "k", ʟ: "l", ᴍ: "m", ɴ: "n", ᴏ: "o", ᴘ: "p", ǫ: "q", ʀ: "r", ꜱ: "s", ᴛ: "t",
  ᴜ: "u", ᴠ: "v", ᴡ: "w", ʏ: "y", ᴢ: "z",
};
const SMALL_CAPS_CLASS = Object.keys(SMALL_CAPS).join("");

// One "fancy unit": a styled code point, or a letter/digit followed by combining
// strikethrough (U+0336) / underline (U+0332) marks.
const UNIT =
  `(?:[\\u{1D400}-\\u{1D7FF}\\u{FF01}-\\u{FF5E}\\u{24B6}-\\u{24E9}\\u{1F130}-\\u{1F189}${SMALL_CAPS_CLASS}]` +
  `|[\\p{L}\\p{N}][\\u0332\\u0336]+)`;

/** Runs of fancy units, allowing spaces and light punctuation between them. */
export const FANCY_RUN = new RegExp(`${UNIT}(?:[ \\t.,!?'’:;&-]*${UNIT})*`, "gu");
const SINGLE_UNIT = new RegExp(UNIT, "gu");

export function findFancyRuns(text: string): { start: number; end: number; value: string }[] {
  const runs: { start: number; end: number; value: string }[] = [];
  for (const m of text.matchAll(FANCY_RUN)) {
    runs.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return runs;
}

/** Convert a single styled code point (or letter + combining marks) to plain text. */
function plainUnit(unit: string): string {
  if (/[̶̲]/u.test(unit)) return unit.replace(/[̶̲]/gu, "");
  if (SMALL_CAPS[unit]) return SMALL_CAPS[unit];
  const cp = unit.codePointAt(0)!;
  // Negative circled (1F150-1F169) and negative squared (1F170-1F189) letters
  // have no compatibility decomposition, so map them by offset.
  if (cp >= 0x1f150 && cp <= 0x1f169) return String.fromCharCode(65 + cp - 0x1f150);
  if (cp >= 0x1f170 && cp <= 0x1f189) return String.fromCharCode(65 + cp - 0x1f170);
  const nfkc = unit.normalize("NFKC");
  return nfkc;
}

/** Replace every styled unit in `value` with its plain equivalent. */
export function toPlain(value: string): string {
  return value.replace(SINGLE_UNIT, plainUnit);
}

const MATH_STYLES: [number, string][] = [
  [0x1d400, "bold"],
  [0x1d434, "italic"],
  [0x1d468, "bold italic"],
  [0x1d49c, "script"],
  [0x1d4d0, "bold script"],
  [0x1d504, "fraktur"],
  [0x1d538, "double-struck"],
  [0x1d56c, "bold fraktur"],
  [0x1d5a0, "sans-serif"],
  [0x1d5d4, "sans-serif bold"],
  [0x1d608, "sans-serif italic"],
  [0x1d63c, "sans-serif bold italic"],
  [0x1d670, "monospace"],
];
const MATH_DIGITS: [number, string][] = [
  [0x1d7ce, "bold"],
  [0x1d7d8, "double-struck"],
  [0x1d7e2, "sans-serif"],
  [0x1d7ec, "sans-serif bold"],
  [0x1d7f6, "monospace"],
];

/**
 * How a screen reader that reads symbol names would announce one styled unit,
 * e.g. "mathematical bold capital H". Behaviour differs between screen readers;
 * this models the verbose case, which is what many users hear.
 */
export function spokenName(unit: string): string {
  if (/[̶̲]/u.test(unit)) {
    return `${unit.replace(/[̶̲]/gu, "")} combining ${unit.includes("̶") ? "long stroke overlay" : "low line"}`;
  }
  if (SMALL_CAPS[unit]) return `latin letter small capital ${SMALL_CAPS[unit].toUpperCase()}`;
  const cp = unit.codePointAt(0)!;
  for (const [base, style] of MATH_DIGITS) {
    if (cp >= base && cp < base + 10) return `mathematical ${style} digit ${cp - base}`;
  }
  if (cp >= 0x1d400 && cp <= 0x1d6a3) {
    for (let i = MATH_STYLES.length - 1; i >= 0; i--) {
      const [base, style] = MATH_STYLES[i];
      if (cp >= base) {
        const offset = cp - base;
        if (offset >= 52) break;
        const letter = String.fromCharCode(offset < 26 ? 65 + offset : 97 + offset - 26);
        return `mathematical ${style} ${offset < 26 ? "capital" : "small"} ${letter.toUpperCase()}`;
      }
    }
  }
  if (cp >= 0xff01 && cp <= 0xff5e) return `fullwidth ${unit.normalize("NFKC")}`;
  if (cp >= 0x24b6 && cp <= 0x24e9) return `circled latin ${cp < 0x24d0 ? "capital" : "small"} letter ${unit.normalize("NFKC").toUpperCase()}`;
  if (cp >= 0x1f130 && cp <= 0x1f189) return `squared latin capital letter ${plainUnit(unit)}`;
  return "mathematical symbol";
}

export function splitUnits(value: string): string[] {
  return [...value.matchAll(SINGLE_UNIT)].map((m) => m[0]);
}

export { SINGLE_UNIT as FANCY_UNIT };
