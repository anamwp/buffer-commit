import { windowLabel } from "@/lib/buffer/ratelimit";
import type { Budget } from "@/lib/server/buffer";

/**
 * Buffer's API quota is shared by every Legible user, so it's shown openly.
 * Values come from the RateLimit headers of the last response.
 */
export function BudgetMeter({ budget }: { budget: Budget[] }) {
  if (!budget.length) return null;
  return (
    <details className="rounded-xl border border-line bg-surface p-3 text-sm">
      <summary className="cursor-pointer font-bold">Shared Buffer API budget</summary>
      <ul className="mt-2 space-y-2">
        {budget.map((b) => {
          const pct = b.quota ? Math.round((b.remaining / b.quota) * 100) : 0;
          return (
            <li key={b.windowSeconds}>
              <div className="flex justify-between">
                <span>{windowLabel(b.windowSeconds)}</span>
                <span>
                  {b.remaining} / {b.quota} left
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-surface-2" aria-hidden="true">
                <div className={`h-1.5 rounded ${pct < 10 ? "bg-high" : "bg-brand"}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
