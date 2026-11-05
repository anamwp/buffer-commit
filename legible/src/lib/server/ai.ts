import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Finding, PostImage } from "../rules";
import { env } from "./env";

const SuggestionSchema = z.object({
  rewrittenText: z
    .string()
    .describe("The full post text with only the listed accessibility issues fixed. Identical to the input if no text issues were listed."),
  altTexts: z
    .array(z.object({ assetIndex: z.number().int(), altText: z.string() }))
    .describe("One entry per image that needs alt text, keyed by the assetIndex given in the request."),
  summary: z.string().describe("One short sentence describing what changed, for the user."),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

const SYSTEM = `You fix accessibility problems in social media posts before they are published.

Rules for text:
- Fix only the issues listed. Keep the author's meaning, voice, language, line breaks, links, @mentions and hashtags (apart from capitalisation fixes).
- Replace look-alike "fancy" Unicode letters with plain letters. Do not add markdown or other formatting.
- Capitalise each word in multi-word hashtags (#SmallBusinessOwner).
- Reduce runs of repeated emoji to one; keep emoji that carry meaning.
- If there are no text issues, return the text unchanged.

Rules for alt text:
- Describe what is visible and what matters for this post, in plain language, usually under 150 characters.
- Include any important text that appears in the image.
- Do not start with "Image of" or "Picture of". Do not guess names, identities or emotions you cannot see.
- Write in the same language as the post.`;

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

export class AiUnavailableError extends Error {}

export async function suggestFixes(input: {
  text: string;
  service: string;
  images: PostImage[];
  findings: Finding[];
}): Promise<Suggestion> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("AI suggestions are not configured.");

  const imagesNeedingAlt = input.images.filter((img) =>
    input.findings.some((f) => (f.rule === "alt-missing" || f.rule === "alt-weak") && f.assetIndex === img.assetIndex),
  );
  const issues = input.findings.map((f) => `- [${f.rule}] ${f.title}`).join("\n") || "- none";

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of imagesNeedingAlt) {
    content.push({ type: "text", text: `Image assetIndex=${img.assetIndex} (current alt text: ${JSON.stringify(img.altText)}):` });
    content.push({ type: "image", source: { type: "url", url: img.url } });
  }
  content.push({
    type: "text",
    text: `Network: ${input.service}\nIssues found:\n${issues}\n\nPost text:\n<post>\n${input.text}\n</post>\n\nReturn the fixed text and alt text for each image shown above.`,
  });

  const response = await anthropic().beta.messages.parse({
    model: env().ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: betaZodOutputFormat(SuggestionSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  if (response.stop_reason === "refusal") throw new AiUnavailableError("The AI declined to suggest a fix for this post.");
  if (!response.parsed_output) throw new AiUnavailableError("The AI response could not be read. Try again.");

  const allowed = new Set(imagesNeedingAlt.map((i) => i.assetIndex));
  return {
    ...response.parsed_output,
    altTexts: response.parsed_output.altTexts.filter((a) => allowed.has(a.assetIndex) && a.altText.trim()),
  };
}
