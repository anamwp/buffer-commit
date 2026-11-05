export type Severity = "high" | "medium" | "low";

export type RuleId =
  | "alt-missing"
  | "alt-weak"
  | "fancy-unicode"
  | "hashtag-case"
  | "emoji-run"
  | "emoji-density"
  | "caps-run"
  | "hashtag-overload";

export interface PostImage {
  /** Position of the image within the post's full asset list. */
  assetIndex: number;
  url: string;
  altText: string;
}

/** The minimal, network-agnostic view of a post that the rules inspect. */
export interface PostForRules {
  text: string;
  service: string;
  images: PostImage[];
}

/** A half-open range of UTF-16 indices into the post text. */
export interface Span {
  start: number;
  end: number;
}

export type Fix =
  | { kind: "replaceText"; span: Span; replacement: string }
  | { kind: "altText"; assetIndex: number };

export interface Finding {
  rule: RuleId;
  severity: Severity;
  title: string;
  detail: string;
  span?: Span;
  assetIndex?: number;
  /** A deterministic fix, when one exists. AI suggestions are produced separately. */
  fix?: Fix;
}
