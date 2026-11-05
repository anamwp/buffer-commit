import { describe, expect, it } from "vitest";
import { emojiName, spokenImage, toSpokenSegments, toSpokenText } from "./index";

describe("screen-reader preview", () => {
  it("names emoji, including skin tones", () => {
    expect(emojiName("🚀")).toBe("rocket");
    expect(emojiName("👍🏽")).toBe("thumbs up: medium skin tone");
  });
  it("reads styled letters one by one", () => {
    const segs = toSpokenSegments("𝐇𝐢 there");
    expect(segs[0]).toEqual({ kind: "fancy", source: "𝐇𝐢", spoken: "mathematical bold capital H, mathematical bold small I" });
    expect(segs[1]).toEqual({ kind: "text", source: " there", spoken: " there" });
  });
  it("produces a speakable string", () => {
    expect(toSpokenText("Launch 🚀🚀 #buildinpublic")).toBe("Launch rocket, rocket, hashtag buildinpublic,");
  });
  it("keeps plain text unchanged", () => {
    expect(toSpokenText("Plain and simple.")).toBe("Plain and simple.");
  });
  it("announces images", () => {
    expect(spokenImage("")).toBe("Image.");
    expect(spokenImage("A red bike")).toBe("Image: A red bike.");
  });
});
