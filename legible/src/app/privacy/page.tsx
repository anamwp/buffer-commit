import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Privacy · Legible" };

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 pb-16 sm:px-6">
        <h1 className="text-3xl font-bold">Privacy</h1>
        <p>Legible is a small independent tool. Here is exactly what it does with your data.</p>
        <h2 className="text-xl font-bold">What Legible stores</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Your Buffer account ID, name, email, timezone and organization names.</li>
          <li>Your Buffer access and refresh tokens, encrypted with AES-256-GCM. They never reach your browser.</li>
          <li>A copy of the scanned posts (text, image URLs, alt text, schedule) so you can review them without extra API calls.</li>
          <li>A log of the fixes and notes you applied.</li>
        </ul>
        <h2 className="text-xl font-bold">What Legible asks Buffer for</h2>
        <p>
          Read your account, organizations, channels and queue (<code>account:read</code>, <code>posts:read</code>), edit posts
          when you press Apply (<code>posts:write</code>), leave Notes when you ask (<code>notes:write</code>), and stay signed in (
          <code>offline_access</code>). Legible never publishes, schedules or deletes posts.
        </p>
        <h2 className="text-xl font-bold">AI suggestions</h2>
        <p>
          When you press &quot;Suggest fixes&quot;, the post text and the URLs of its images are sent to Anthropic&apos;s Claude API to
          draft alt text and a rewrite. Nothing is sent unless you press the button, and nothing is applied until you review it.
        </p>
        <h2 className="text-xl font-bold">Deleting your data</h2>
        <p>
          &quot;Disconnect &amp; delete my data&quot; on your queue page deletes everything above immediately. You can also revoke
          Legible from Buffer&apos;s settings at any time.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
