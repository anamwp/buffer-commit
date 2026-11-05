import { describe, expect, it } from "vitest";
import { analyzePost, applyTextFixes, scorePost } from "../index";
import { getDictionary } from "../dictionary";
import { camelCaseSuggestion, segment } from "../hashtags";
import { findFancyRuns, spokenName, toPlain } from "../fancy";
import { findEmojiRuns } from "../emoji";

const dict = getDictionary();
const post = (text: string, images: { altText: string }[] = [], service = "linkedin") => ({
  text,
  service,
  images: images.map((img, i) => ({ assetIndex: i, url: `https://cdn.example.com/${i}.jpg`, altText: img.altText })),
});
const rules = (p: ReturnType<typeof post>) => analyzePost(p, dict).map((f) => f.rule);

describe("alt text", () => {
  it("flags missing alt text as high severity", () => {
    const f = analyzePost(post("Hello", [{ altText: "" }, { altText: "   " }]), dict);
    expect(f.filter((x) => x.rule === "alt-missing")).toHaveLength(2);
    expect(f[0].severity).toBe("high");
    expect(f[0].fix).toEqual({ kind: "altText", assetIndex: 0 });
  });
  it.each(["IMG_1234", "image", "photo 2", "DSC0042", "team-offsite.jpg", "screenshot", "short"])(
    "flags placeholder alt %s",
    (altText) => expect(rules(post("Hello", [{ altText }]))).toEqual(["alt-weak"]),
  );
  it("flags redundant 'image of' prefix as low", () => {
    const f = analyzePost(post("Hi", [{ altText: "Image of our team laughing at the offsite" }]), dict);
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("low");
  });
  it("accepts a real description", () => {
    expect(rules(post("Hi", [{ altText: "Five people laughing around a picnic table in a park" }]))).toEqual([]);
  });
});

describe("fancy unicode", () => {
  const bold = "𝐁𝐢𝐠 𝐧𝐞𝐰𝐬"; // mathematical bold
  it("finds a styled run including the space and converts to plain", () => {
    const runs = findFancyRuns(`${bold} today`);
    expect(runs).toHaveLength(1);
    expect(toPlain(runs[0].value)).toBe("Big news");
  });
  it("handles italic, script, fullwidth, circled, small caps and strikethrough", () => {
    expect(toPlain("𝘩𝘦𝘭𝘭𝘰")).toBe("hello");
    expect(toPlain("𝓗𝓲")).toBe("Hi");
    expect(toPlain("ＷＩＤＥ")).toBe("WIDE");
    expect(toPlain("ⓒⓘⓡⓒⓛⓔ")).toBe("circle");
    expect(toPlain("ꜱᴍᴀʟʟ")).toBe("small");
    expect(toPlain("s̶a̶l̶e̶")).toBe("sale");
    expect(toPlain("🅽🅴🆆")).toBe("NEW");
  });
  it("reports extra UTF-16 cost and offers a replacement fix", () => {
    const f = analyzePost(post(`${bold} today`), dict).find((x) => x.rule === "fancy-unicode")!;
    expect(f.severity).toBe("high");
    expect(f.detail).toContain("7 extra characters");
    expect(applyTextFixes(`${bold} today`, [f])).toBe("Big news today");
  });
  it("names styled letters the way verbose screen readers do", () => {
    expect(spokenName("𝐇")).toBe("mathematical bold capital H");
    expect(spokenName("𝘩")).toBe("mathematical sans-serif italic small H");
    expect(spokenName("𝟓")).toBe("mathematical bold digit 5");
  });
  it("leaves ordinary accented text alone", () => {
    expect(findFancyRuns("Café déjà vu — naïve résumé ™ ²")).toEqual([]);
  });
});

describe("hashtags", () => {
  it("segments into the fewest dictionary words", () => {
    expect(segment("smallbusinessowner", dict)).toEqual(["small", "business", "owner"]);
  });
  it("suggests CamelCase for multi-word lowercase tags", () => {
    expect(camelCaseSuggestion("socialmediatips", dict)).toBe("SocialMediaTips");
    expect(camelCaseSuggestion("WOMENINSTEM", dict)).toBe("WomenInStem");
  });
  it("does not flag single words, mixed case, short or unknown tags", () => {
    expect(camelCaseSuggestion("accessibility", dict)).toBeNull();
    expect(camelCaseSuggestion("SocialMedia", dict)).toBeNull();
    expect(camelCaseSuggestion("ux", dict)).toBeNull();
    expect(camelCaseSuggestion("xqzvbnmkl", dict)).toBeNull();
  });
  it("produces a fix and flags hashtag overload", () => {
    const text = "Launch day #buildinpublic #a #b #c #d #e";
    const f = analyzePost(post(text), dict);
    expect(f.map((x) => x.rule)).toEqual(expect.arrayContaining(["hashtag-case", "hashtag-overload"]));
    expect(applyTextFixes(text, f)).toBe("Launch day #BuildInPublic #a #b #c #d #e");
  });
});

describe("emoji", () => {
  it("finds runs of 3+ emoji separated by spaces, not across lines", () => {
    expect(findEmojiRuns("Go 🚀🚀🚀 now")).toHaveLength(1);
    expect(findEmojiRuns("Go 🚀 🔥 👏🏽 now")[0].items).toHaveLength(3);
    expect(findEmojiRuns("🚀\n🔥\n👏")).toHaveLength(0);
    expect(findEmojiRuns("Nice 🚀🔥")).toHaveLength(0);
  });
  it("collapses a run to its first emoji", () => {
    const text = "We shipped 🚀🚀🚀🔥 today";
    expect(applyTextFixes(text, analyzePost(post(text), dict))).toBe("We shipped 🚀 today");
  });
});

describe("caps", () => {
  it("flags long all-caps runs but not single acronyms", () => {
    expect(rules(post("HUGE SALE THIS WEEKEND ONLY"))).toContain("caps-run");
    expect(rules(post("Join our AMA with the CEO at NASA"))).not.toContain("caps-run");
  });
});

describe("scoring and fixes", () => {
  it("scores a clean post 100 and penalises by severity", () => {
    expect(scorePost([])).toBe(100);
    const f = analyzePost(post("𝐁𝐢𝐠 news 🚀🚀🚀", [{ altText: "" }]), dict);
    expect(scorePost(f)).toBe(100 - 25 - 25 - 10);
  });
  it("applies several non-overlapping fixes at once", () => {
    const text = "𝐁𝐢𝐠 𝐧𝐞𝐰𝐬 🚀🚀🚀 #socialmediatips";
    expect(applyTextFixes(text, analyzePost(post(text), dict))).toBe("Big news 🚀 #SocialMediaTips");
  });
});
