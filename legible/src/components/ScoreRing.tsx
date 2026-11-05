"use client";

import { useEffect, useState } from "react";

/** Animated 0-100 ring. Colour shifts from red to green as the score rises. */
export function ScoreRing({ score, size = 96, label = "Legibility score" }: { score: number; size?: number; label?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 90 ? "var(--good)" : score >= 70 ? "var(--medium)" : "var(--high)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label}: ${score} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1), stroke 400ms" }}
        />
      </svg>
      <span aria-hidden="true" className="absolute text-2xl font-bold" style={{ fontSize: size / 4 }}>
        {score}
      </span>
    </div>
  );
}
