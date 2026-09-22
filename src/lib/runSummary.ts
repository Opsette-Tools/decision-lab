/**
 * One type-agnostic summary of a run, for the list surfaces.
 *
 * History and Home both want the same four things from a run — a state, a
 * label, a number to show, and how much of it is answered — and neither wants
 * to learn how each type scores. Without this, every list page grows its own
 * switch over `ScorecardType` and they drift apart the first time a type is
 * added. The registry pattern applied to scoring.
 *
 * Returns null for a run whose type has no engine, so a row still lists rather
 * than crashing the page.
 */

import type { Run, VerdictTone } from "@/db/types";
import { scoreSavedRun } from "@/types/advanced/score";
import { scoreSavedFormsRun } from "@/types/forms/score";

export interface RunSummary {
  state: VerdictTone | "disqualified";
  stateLabel: string;
  /** What the score column shows: "74%", "9/15", "No", or "—". */
  scoreText: string;
  answeredCount: number;
  totalCount: number;
  /** Conditions raised. Always 0 for types that have no blockers. */
  blockerCount: number;
}

export function summarizeRun(run: Run): RunSummary | null {
  switch (run.scorecardSnapshot.content.type) {
    case "advanced": {
      const result = scoreSavedRun(run);
      if (!result) return null;
      return {
        state: result.state,
        stateLabel: result.stateLabel,
        scoreText: result.disqualifiedBy
          ? "No"
          : result.percent === null
            ? "—"
            : `${result.percent}%`,
        answeredCount: result.answeredCount,
        totalCount: result.totalCount,
        blockerCount: result.blockers.length,
      };
    }
    case "forms": {
      const result = scoreSavedFormsRun(run);
      if (!result) return null;
      const doc = run.scorecardSnapshot.content.doc;
      const display = doc.scoreDisplay ?? "percent";
      // An unscored questionnaire has no verdict to report, so the column shows
      // progress instead of a percentage that would mean nothing.
      const scoreText = !result.scored
        ? `${result.answeredCount}/${result.totalCount}`
        : result.percent === null
          ? "—"
          : display === "number"
            ? `${result.displayScore}/${result.maxScore}`
            : display === "off"
              ? `${result.answeredCount}/${result.totalCount}`
              : `${result.percent}%`;
      return {
        state: result.state,
        stateLabel: result.stateLabel,
        scoreText,
        answeredCount: result.answeredCount,
        totalCount: result.totalCount,
        blockerCount: 0,
      };
    }
  }
}
