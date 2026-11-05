"use client";

import { useEffect, useState } from "react";
import { analyzePost, type Dictionary, type Finding, type PostForRules } from "@/lib/rules";

/**
 * The rules run in the browser for instant feedback. The ~380 KB dictionary is
 * loaded lazily so it doesn't block first paint.
 */
export function useAnalyzer() {
  const [dict, setDict] = useState<Dictionary | null>(null);
  useEffect(() => {
    let alive = true;
    import("@/lib/rules/dictionary").then((m) => alive && setDict(m.getDictionary()));
    return () => {
      alive = false;
    };
  }, []);
  return {
    ready: dict !== null,
    analyze: (post: PostForRules): Finding[] => (dict ? analyzePost(post, dict) : []),
  };
}
