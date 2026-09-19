/**
 * IndexedDB-backed CRUD for run history.
 *
 * A run is written once and then effectively frozen: its answers get filled in
 * live, and after that it exists to be compared against other runs. The one
 * thing this repo must never do is let a scorecard edit reach back into a saved
 * run — see `scorecardSnapshot` in db/types.ts.
 *
 * Type-agnostic, like scorecardsRepo: `answers` is a tagged union and this file
 * only ever swaps whole values in and out of it.
 */

import { uuid } from "@/lib/uuid";
import {
  forgetParentKnown,
  getBridgeInstance,
  isBridgeMode,
  isParentKnown,
  markParentKnown,
} from "@/lib/bridgeInstance";
import { getDb } from "./db";
import { RUNS_STORE, type BridgedValue, type Run, type RunAnswers, type Scorecard } from "./types";

function persistToBridge(run: Run): void {
  const bridge = getBridgeInstance();
  if (!bridge) return;
  const { id, ...rest } = run;
  bridge
    .save(id, { kind: "run", value: rest })
    .then(() => markParentKnown(id))
    .catch(() => {
      /* onTimeout hook in main.tsx surfaces the toast */
    });
}

/** A fresh, empty answer set matching the scorecard's type. */
function emptyAnswers(scorecard: Scorecard): RunAnswers {
  switch (scorecard.content.type) {
    case "advanced":
      return { type: "advanced", values: {} };
    case "forms":
      return { type: "forms", values: {} };
  }
}

export const runsRepo = {
  async list(): Promise<Run[]> {
    const db = await getDb();
    const all = (await db.getAll(RUNS_STORE)) as Run[];
    return all.sort((a, b) => b.startedAt - a.startedAt);
  },

  /** Every run of one scorecard, newest first — the comparison view's query. */
  async listForScorecard(scorecardId: string): Promise<Run[]> {
    const db = await getDb();
    const rows = (await db.getAllFromIndex(RUNS_STORE, "scorecardId", scorecardId)) as Run[];
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  },

  async get(id: string): Promise<Run | undefined> {
    const db = await getDb();
    return (await db.get(RUNS_STORE, id)) as Run | undefined;
  },

  /**
   * Start a run. The scorecard is deep-copied into the run at this moment and
   * never re-read from the library afterward — that snapshot is what the run is
   * scored against for the rest of its life.
   */
  async start(scorecard: Scorecard, subject?: string): Promise<Run> {
    const db = await getDb();
    const run: Run = {
      id: uuid(),
      scorecardId: scorecard.id,
      // structuredClone, not a spread: a spread would leave the nested arrays
      // shared with the live scorecard object, so a later edit in the same
      // session would mutate this run's "frozen" snapshot in place.
      scorecardSnapshot: structuredClone(scorecard),
      subject: subject?.trim() || "",
      answers: emptyAnswers(scorecard),
      startedAt: Date.now(),
    };
    await db.put(RUNS_STORE, run);
    persistToBridge(run);
    return run;
  },

  /** Swap the whole answer set. Each type's run screen owns the shape. */
  async setAnswers(id: string, answers: RunAnswers): Promise<Run | undefined> {
    const db = await getDb();
    const existing = (await db.get(RUNS_STORE, id)) as Run | undefined;
    if (!existing) return undefined;
    const updated: Run = { ...existing, answers };
    await db.put(RUNS_STORE, updated);
    persistToBridge(updated);
    return updated;
  },

  async update(
    id: string,
    patch: Partial<Pick<Run, "subject" | "notes" | "completedAt">>,
  ): Promise<Run | undefined> {
    const db = await getDb();
    const existing = (await db.get(RUNS_STORE, id)) as Run | undefined;
    if (!existing) return undefined;
    const updated: Run = { ...existing, ...patch };
    await db.put(RUNS_STORE, updated);
    persistToBridge(updated);
    return updated;
  },

  async complete(id: string): Promise<Run | undefined> {
    return runsRepo.update(id, { completedAt: Date.now() });
  },

  /** Reopen a completed run. Clearing the field is what "in progress" means. */
  async reopen(id: string): Promise<Run | undefined> {
    const db = await getDb();
    const existing = (await db.get(RUNS_STORE, id)) as Run | undefined;
    if (!existing) return undefined;
    const { completedAt: _dropped, ...rest } = existing;
    await db.put(RUNS_STORE, rest as Run);
    persistToBridge(rest as Run);
    return rest as Run;
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(RUNS_STORE, id);
    if (isBridgeMode() && isParentKnown(id)) {
      const bridge = getBridgeInstance();
      forgetParentKnown(id);
      bridge?.delete(id).catch(() => {
        /* optimistic UI already advanced; onTimeout surfaces the toast */
      });
    }
  },

  /** Deleting a scorecard orphans its runs; callers decide whether to cascade. */
  async removeForScorecard(scorecardId: string): Promise<void> {
    const runs = await runsRepo.listForScorecard(scorecardId);
    for (const run of runs) await runsRepo.remove(run.id);
  },
};

/** See hydrateScorecardsFromBridge — same contract, runs half of init.items. */
export async function hydrateRunsFromBridge(
  items: Array<{ data_id: string; value: BridgedValue }>,
): Promise<string[]> {
  const rows = items.filter(
    (item): item is { data_id: string; value: Extract<BridgedValue, { kind: "run" }> } =>
      !!item.value && typeof item.value === "object" && item.value.kind === "run",
  );
  if (rows.length === 0) return [];
  const db = await getDb();
  const tx = db.transaction(RUNS_STORE, "readwrite");
  const ids: string[] = [];
  for (const { data_id, value } of rows) {
    await tx.store.put({ ...value.value, id: data_id } satisfies Run);
    ids.push(data_id);
  }
  await tx.done;
  return ids;
}
