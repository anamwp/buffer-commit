import { describe, expect, it } from "vitest";
import { parseRateLimit } from "./ratelimit";

describe("parseRateLimit", () => {
  it("parses joined headers and matches policies by name", () => {
    const rl = '"150-in-15min"; r=98; t=897, "600-in-1day"; r=598; t=86397, "3000-in-30days"; r=2969; t=696980';
    const pol =
      '"150-in-15min"; q=150; w=900; pk=:ZjJj:, "600-in-1day"; q=600; w=86400; pk=:ZjJj:, "3000-in-30days"; q=3000; w=2592000; pk=:ZjJj:';
    expect(parseRateLimit(rl, pol)).toEqual([
      { name: "150-in-15min", windowSeconds: 900, quota: 150, remaining: 98, resetSeconds: 897 },
      { name: "600-in-1day", windowSeconds: 86400, quota: 600, remaining: 598, resetSeconds: 86397 },
      { name: "3000-in-30days", windowSeconds: 2592000, quota: 3000, remaining: 2969, resetSeconds: 696980 },
    ]);
  });
  it("handles the no-space form and missing policy header", () => {
    expect(parseRateLimit('"100-in-15min";r=0;t=753', null)).toEqual([
      { name: "100-in-15min", windowSeconds: 900, quota: 100, remaining: 0, resetSeconds: 753 },
    ]);
  });
  it("returns [] when absent", () => {
    expect(parseRateLimit(null, null)).toEqual([]);
  });
});
