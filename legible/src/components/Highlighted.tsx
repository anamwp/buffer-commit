import type { Finding, Severity } from "@/lib/rules";

const MARK: Record<Severity, string> = {
  high: "bg-high-soft text-high underline decoration-wavy decoration-high/60",
  medium: "bg-medium-soft text-medium underline decoration-dotted",
  low: "bg-low-soft text-low",
};

/** Render text with each finding's span marked. Overlapping spans keep the first. */
export function Highlighted({ text, findings }: { text: string; findings: Finding[] }) {
  const spans = findings
    .filter((f) => f.span)
    .sort((a, b) => a.span!.start - b.span!.start)
    .reduce<Finding[]>((acc, f) => {
      const last = acc[acc.length - 1];
      if (!last || f.span!.start >= last.span!.end) acc.push(f);
      return acc;
    }, []);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((f, i) => {
    const { start, end } = f.span!;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={i} className={`rounded px-0.5 ${MARK[f.severity]}`} title={f.title}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  parts.push(text.slice(cursor));
  return <p className="whitespace-pre-wrap break-words leading-relaxed">{parts}</p>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = {
    high: "bg-high-soft text-high",
    medium: "bg-medium-soft text-medium",
    low: "bg-low-soft text-low",
  }[severity];
  const label = { high: "Blocks access", medium: "Hard to follow", low: "Could be clearer" }[severity];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${style}`}>{label}</span>;
}
