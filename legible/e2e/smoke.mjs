// End-to-end smoke test against the mock Buffer server (scripts/mock-buffer.mjs).
//   node scripts/mock-buffer.mjs &  (and the app running with BUFFER_*_URL pointing at it)
//   APP_URL=http://localhost:3000 node e2e/smoke.mjs
import { createRequire } from "node:module";
// CJS require so a globally installed Playwright (NODE_PATH) also works.
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_URL ?? "http://localhost:4010";
const SHOTS = process.env.SHOTS_DIR;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const shot = async (name) => {
  if (!SHOTS) return;
  await page.waitForTimeout(1100); // let score rings finish animating
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const mockLog = async () => (await (await fetch(`${MOCK}/__log`)).json()).log;
const step = (s) => console.log(`✓ ${s}`);

try {
  // 1. Landing playground works without sign-in.
  await page.goto(APP);
  await page.getByRole("heading", { name: "Is your queue readable?" }).waitFor();
  await page.getByText(/issues found/).waitFor();
  const issues = await page.getByText(/\d+ issues found/).textContent();
  assert.ok(Number(issues.match(/\d+/)[0]) >= 5, `playground should find issues, got: ${issues}`);
  assert.ok(await page.getByText("mathematical bold capital B").first().isVisible(), "transcript names fancy letters");
  await shot("01-landing");
  await page.getByRole("button", { name: "Apply text fixes" }).click();
  assert.match(await page.locator("#post-text").inputValue(), /^🚀 Big news: .*#SmallBusinessOwner #SocialMediaTips$/s);
  step("landing playground analyses, transcribes and fixes text");

  // 2. OAuth with PKCE through the mock.
  await page.getByRole("link", { name: "Connect Buffer" }).first().click();
  await page.waitForURL(`${APP}/app`);
  await page.getByRole("heading", { name: "Your queue" }).waitFor();
  step("Buffer OAuth (PKCE + state) completes and lands on /app");

  // 3. Scan.
  await page.getByRole("button", { name: /Scan the next 14 days/ }).click();
  await page.getByRole("heading", { name: "Posts to fix" }).waitFor();
  const cards = page.locator('a[href^="/app/posts/"]');
  assert.equal(await cards.count(), 3, "three posts need attention");
  assert.equal((await mockLog()).filter((e) => e.op === "Scan").length, 1, "scan is a single API request");
  await shot("02-dashboard");
  step("scan finds 3 posts to fix in one Scan request");

  // Cooldown prevents burning quota.
  await page.getByRole("button", { name: "Scan again" }).click();
  await page.getByRole("alert").filter({ hasText: "scanned a moment ago" }).waitFor();
  step("rescan cooldown protects the shared quota");

  // 4. Fix the worst post: quick text fixes + alt text, apply.
  await page.goto(`${APP}/app/posts/6500000000000000000000a1`);
  await page.getByRole("button", { name: "Quick text fixes" }).click();
  await page.getByLabel("Alt text for image 1").fill("A laptop showing the course homepage with the headline Accessible Social Media");
  await shot("03-post-before-apply");
  await page.getByRole("button", { name: "Apply to Buffer" }).click();
  await page.getByRole("status").filter({ hasText: "Saved to Buffer" }).waitFor();
  const edit = (await mockLog()).filter((e) => e.op === "EditPost").at(-1).variables.input;
  assert.equal(edit.mode, undefined, "schedule untouched");
  assert.match(edit.text, /^🚀 Big news: our accessibility course is LIVE TODAY ONLY!!! 🔥/);
  assert.match(edit.text, /#SmallBusinessOwner #SocialMediaTips$/);
  assert.equal(edit.assets[0].image.metadata.altText, "A laptop showing the course homepage with the headline Accessible Social Media");
  await shot("04-post-after-apply");
  step("editPost sends fixed text + alt text and no schedule change");

  // 5. Alt-only fix keeps the other image and its user tags.
  await page.goto(`${APP}/app/posts/6500000000000000000000a2`);
  await page.getByLabel("Alt text for image 1").fill("A ceramic mug on a desk next to a sketchbook");
  await page.getByRole("button", { name: "Apply to Buffer" }).click();
  await page.getByRole("status").filter({ hasText: "1 alt text updated" }).waitFor();
  const edit2 = (await mockLog()).filter((e) => e.op === "EditPost").at(-1).variables.input;
  assert.equal(edit2.text, undefined, "text not sent when unchanged");
  assert.equal(edit2.assets.length, 2);
  assert.deepEqual(edit2.assets[0].image.metadata.userTags, [{ handle: "legible", x: 0.4, y: 0.6 }]);
  assert.equal(edit2.assets[1].image.metadata.altText, "Two designers sketching at a whiteboard");
  step("alt-only edit preserves every asset and Instagram user tags");

  // 6. Threads are never edited; Notes work.
  await page.goto(`${APP}/app/posts/6500000000000000000000a3`);
  await page.getByText("This is a thread").waitFor();
  assert.equal(await page.getByRole("button", { name: "Apply to Buffer" }).count(), 0);
  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByRole("status").filter({ hasText: "Note added" }).waitFor();
  assert.ok((await mockLog()).some((e) => e.op === "CreateNote" && e.variables.input.subject.postId === "6500000000000000000000a3"));
  step("threads are read-only; Buffer Note created");

  // 7. Dashboard reflects fixes.
  await page.goto(`${APP}/app`);
  // a2 is fully fixed; a1 keeps a low-severity "LIVE TODAY ONLY" caps finding.
  assert.equal(await page.locator('a[href="/app/posts/6500000000000000000000a2"]').count(), 0, "fixed post leaves the list");
  assert.equal(await page.locator('a[href^="/app/posts/"]').count(), 2);
  await page.getByText(/fixed 2 in the last 30 days/).waitFor();
  step("dashboard updates after fixes");

  console.log("\nAll smoke checks passed.");
} catch (err) {
  await shot("failure");
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
