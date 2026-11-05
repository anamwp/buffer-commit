import { describe, expect, it } from "vitest";
import { assertMutation, rebuildAssets, type ApiAsset } from "./operations";
import { BufferMutationError } from "./errors";

describe("rebuildAssets", () => {
  const assets: ApiAsset[] = [
    {
      __typename: "ImageAsset",
      type: "image",
      source: "https://cdn/a.jpg",
      thumbnail: "https://cdn/a_t.jpg",
      image: { altText: "", userTags: [{ handle: "anam", x: 0.5, y: 0.4 }] },
    },
    { __typename: "VideoAsset", type: "video", source: "https://cdn/v.mp4", thumbnail: "t", video: { thumbnailOffset: 2000, title: null } },
    { __typename: "DocumentAsset", type: "document", source: "https://cdn/d.pdf", thumbnail: "https://cdn/d.jpg", document: { title: "Q3" } },
    { __typename: "ImageAsset", type: "image", source: "https://cdn/b.jpg", thumbnail: "t", image: { altText: "Old", userTags: null } },
  ];
  it("keeps every asset in order and preserves metadata", () => {
    expect(rebuildAssets(assets, { 0: "A cat on a desk" })).toEqual([
      { image: { url: "https://cdn/a.jpg", metadata: { altText: "A cat on a desk", userTags: [{ handle: "anam", x: 0.5, y: 0.4 }] } } },
      { video: { url: "https://cdn/v.mp4", metadata: { thumbnailOffset: 2000 } } },
      { document: { url: "https://cdn/d.pdf", thumbnailUrl: "https://cdn/d.jpg", title: "Q3" } },
      { image: { url: "https://cdn/b.jpg", metadata: { altText: "Old" } } },
    ]);
  });
});

describe("assertMutation", () => {
  it("passes success and throws typed errors", () => {
    expect(assertMutation({ __typename: "PostActionSuccess" }, "PostActionSuccess")).toBeTruthy();
    expect(() => assertMutation({ __typename: "InvalidInputError", message: "Too long" }, "PostActionSuccess")).toThrow(
      BufferMutationError,
    );
  });
});
