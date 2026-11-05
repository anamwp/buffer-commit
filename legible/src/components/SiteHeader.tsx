import Link from "next/link";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
      <Link href={signedIn ? "/app" : "/"} className="flex items-center gap-2 text-xl font-bold">
        <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="var(--brand)" />
          <path d="M20 16v32h24" fill="none" stroke="var(--brand-ink)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="44" cy="22" r="5" fill="#f2c46b" />
        </svg>
        Legible
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/privacy" className="text-ink-2 hover:text-ink">
          Privacy
        </Link>
        {signedIn ? (
          <form action="/auth/logout" method="post">
            <button className="rounded-full border border-line px-4 py-2 font-bold">Sign out</button>
          </form>
        ) : (
          <a href="/auth/buffer/start" className="rounded-full bg-brand px-4 py-2 font-bold text-brand-ink">
            Connect Buffer
          </a>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-4 py-10 text-sm text-ink-2 sm:px-6">
      Built on the Buffer API for Buffer Commit 2026. Legible is an independent project and is not made or endorsed by Buffer.
    </footer>
  );
}
