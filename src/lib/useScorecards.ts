import { useCallback, useEffect, useState } from "react";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import type { Scorecard } from "@/db/types";

/**
 * Load the scorecard library (every type). `reload` is handed back so a caller that mutates
 * (create, duplicate, delete) can refresh without a router navigation.
 *
 * Deliberately not a context provider: the library is read on two pages and
 * both want their own loading state. A shared provider would make one page's
 * refresh flash the other.
 */
export function useScorecards() {
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setScorecards(await scorecardsRepo.list());
    } catch (err) {
      console.error("[decision-lab] failed to load scorecards:", err);
      setScorecards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { scorecards, loading, reload };
}
