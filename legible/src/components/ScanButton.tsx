"use client";

import { useState, useTransition } from "react";
import { scanAction } from "@/app/app/actions";

export function ScanButton({ hasScan }: { hasScan: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ error: string; reconnect?: boolean } | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await scanAction();
            if (!res.ok) setError(res);
          })
        }
        className="rounded-full bg-brand px-6 py-3 text-lg font-bold text-brand-ink disabled:opacity-60"
      >
        {pending ? "Scanning your queue…" : hasScan ? "Scan again" : "Scan the next 14 days"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-high">
          {error.error}{" "}
          {error.reconnect && (
            <a href="/auth/buffer/start" className="underline">
              Reconnect Buffer
            </a>
          )}
        </p>
      )}
    </div>
  );
}
