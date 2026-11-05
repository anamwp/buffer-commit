import { Playground } from "@/components/Playground";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/server/session";

const ERRORS: Record<string, string> = {
  state: "That sign-in link expired or was opened in another browser. Please try connecting again.",
  denied: "You cancelled the Buffer connection. Nothing was shared.",
  oauth: "Buffer couldn't complete the connection. Please try again.",
};

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  let signedIn = false;
  try {
    signedIn = Boolean((await getSession()).userId);
  } catch {
    // Env not configured (e.g. the playground running on its own): stay signed out.
  }
  const error = params.error ? ERRORS[params.error] ?? ERRORS.oauth : null;

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {error && (
          <p role="alert" className="mb-6 rounded-xl bg-high-soft p-4 font-bold text-high">
            {error}
          </p>
        )}
        {params.deleted && (
          <p role="status" className="mb-6 rounded-xl bg-good-soft p-4 font-bold text-good">
            Disconnected. Your tokens and scan data have been deleted.
          </p>
        )}
        <section className="py-8 sm:py-14">
          <p className="font-bold text-brand">For everyone who posts every day</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Is your queue readable?</h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-2 sm:text-xl">
            Legible checks the posts waiting in your Buffer queue for missing alt text, fancy Unicode that screen readers
            can&apos;t read, unreadable hashtags and emoji walls. It fixes them before they publish, and lets you hear each
            post the way a screen-reader user will.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={signedIn ? "/app" : "/auth/buffer/start"} className="rounded-full bg-brand px-6 py-3 text-lg font-bold text-brand-ink">
              {signedIn ? "Open your queue" : "Connect Buffer"}
            </a>
            <a href="#try-heading" className="rounded-full border border-line px-6 py-3 text-lg font-bold">
              Try it first
            </a>
          </div>
        </section>

        <Playground />

        <section className="mt-16 grid gap-6 sm:grid-cols-3" aria-label="How it works">
          {[
            ["1. Connect", "Sign in with Buffer. Legible asks only to read your queue, edit posts you approve, and leave Notes."],
            ["2. Scan", "Your next 14 days of scheduled posts and recent drafts are checked in one request."],
            ["3. Fix", "Review each suggestion, then apply it to Buffer. Your schedule stays exactly as it was."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 text-ink-2">{body}</p>
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
