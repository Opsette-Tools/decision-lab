/**
 * The scoring engine. Pure, deterministic, dependency-free.
 *
 * Deliberately knows nothing about clients, leads, vendors, or any domain — it
 * sees criteria, weights, and answers. Domain meaning is entirely in the data.
 * There is no AI here and there must never be: the whole value of the tool is
 * that the same answers produce the same verdict every time, with visible
 * arithmetic. See docs/DECISION_LAB_PLAN.md §2 and §6.
 *
 *   score    = Σ (answerValue × criterionWeight)   over ANSWERED criteria
 *   maxScore = Σ (maxOptionValue × criterionWeight) over ANSWERED criteria
 *   percent  = round(score / maxScore × 100)
 *
 * Skipped criteria are excluded from BOTH terms. Calls don't go in order, and
 * an unanswered question must never read as a zero — that would punish the
 * operator for not having asked yet.
 */

import type { Run, Threshold, VerdictTone } from "@/db/types";
import type { AdvancedDoc, AnswerOption, Criterion } from "./model";

/** One criterion's contribution, kept for the "show the arithmetic" UI. */
export interface LineItem {
  criterion: Criterion;
  /** The chosen option, or null when the criterion was skipped. */
  option: AnswerOption | null;
  /** answerValue × weight. 0 for a skipped criterion (excluded, not scored). */
  points: number;
  /** The best this criterion could have contributed. 0 when skipped. */
  maxPoints: number;
}

/** A blocker raised by a given answer — a condition of delivery, not a fault. */
export interface Blocker {
  criterionId: string;
  criterionLabel: string;
  optionLabel: string;
  /** The explicit note if the option carried one, else a sensible fallback. */
  note: string;
}

export type VerdictState = "disqualified" | VerdictTone;

export interface ScoreResult {
  /** Weighted points earned across answered criteria. */
  score: number;
  /** Weighted points available across answered criteria. */
  maxScore: number;
  /** 0..100. Null when nothing has been answered yet — NOT zero, which would
   *  read as "scored badly" rather than "not started". */
  percent: number | null;
  /** How many criteria have an answer, and how many exist in total. */
  answeredCount: number;
  totalCount: number;
  /** Per-criterion breakdown, in scorecard order, including skipped ones. */
  lineItems: LineItem[];
  /** Accumulated in scorecard order. This list is the scope conversation. */
  blockers: Blocker[];
  /** Set when a chosen answer carries `disqualifies`. Overrides percent. */
  disqualifiedBy: {
    criterionId: string;
    criterionLabel: string;
    optionLabel: string;
  } | null;
  /** The band the percent falls into, or null if unscored/disqualified. */
  threshold: Threshold | null;
  /** The single state the whole surface should take on. */
  state: VerdictState;
  /** Human label for the state: the threshold label, or a fixed string. */
  stateLabel: string;
}

/** Highest option value in a criterion — the ceiling for its contribution. */
export function maxOptionValue(criterion: Criterion): number {
  if (criterion.options.length === 0) return 0;
  return criterion.options.reduce((best, o) => (o.value > best ? o.value : best), criterion.options[0].value);
}

/**
 * Pick the band a percentage falls into: the highest `min` that the percent
 * meets or exceeds. Thresholds need not arrive sorted.
 */
export function thresholdFor(thresholds: Threshold[], percent: number): Threshold | null {
  let best: Threshold | null = null;
  for (const t of thresholds) {
    if (percent >= t.min && (best === null || t.min > best.min)) best = t;
  }
  return best;
}

/**
 * Score a set of answers against an advanced scorecard's doc.
 *
 * `answers` maps criterionId -> optionId; a missing or unrecognized key means
 * skipped. Unrecognized ids are treated as skipped rather than throwing, so a
 * run whose snapshot lost an option (hand-edited export, older build)
 * still renders instead of crashing the page.
 */
export function scoreRun(doc: AdvancedDoc, answers: Record<string, string>): ScoreResult {
  const lineItems: LineItem[] = [];
  const blockers: Blocker[] = [];
  let score = 0;
  let maxScore = 0;
  let answeredCount = 0;
  let disqualifiedBy: ScoreResult["disqualifiedBy"] = null;

  for (const criterion of doc.criteria) {
    const optionId = answers[criterion.id];
    const option = optionId ? criterion.options.find((o) => o.id === optionId) ?? null : null;

    if (!option) {
      // Skipped: contributes to neither term. Recorded so the breakdown can
      // show it as deliberately unanswered rather than omitting the row.
      lineItems.push({ criterion, option: null, points: 0, maxPoints: 0 });
      continue;
    }

    answeredCount += 1;
    const points = option.value * criterion.weight;
    const maxPoints = maxOptionValue(criterion) * criterion.weight;
    score += points;
    maxScore += maxPoints;
    lineItems.push({ criterion, option, points, maxPoints });

    if (option.blocks) {
      blockers.push({
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        optionLabel: option.label,
        note: option.blockerNote?.trim() || `Resolve before delivery: ${criterion.label}`,
      });
    }

    // First disqualifying answer wins — the run is over either way, and naming
    // the first one encountered matches the order the operator asked in.
    if (option.disqualifies && !disqualifiedBy) {
      disqualifiedBy = {
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        optionLabel: option.label,
      };
    }
  }

  // Percent is null (not 0) until something is answered, and guarded against a
  // zero denominator — a scorecard whose answered criteria all top out at value 0
  // has no meaningful percentage to report.
  const percent = answeredCount === 0 || maxScore === 0 ? null : Math.round((score / maxScore) * 100);

  const threshold = percent === null ? null : thresholdFor(doc.thresholds, percent);

  let state: VerdictState;
  let stateLabel: string;
  if (disqualifiedBy) {
    // A disqualifying answer overrides the percentage entirely — a 90% run
    // with one dealbreaker is still a no.
    state = "disqualified";
    stateLabel = "Disqualified";
  } else if (percent === null) {
    state = "warn";
    stateLabel = "Not started";
  } else if (threshold) {
    state = threshold.tone;
    stateLabel = threshold.label;
  } else {
    // Percent exists but sits below every band's floor.
    state = "fail";
    stateLabel = "Below range";
  }

  return {
    score,
    maxScore,
    percent,
    answeredCount,
    totalCount: doc.criteria.length,
    lineItems,
    blockers,
    disqualifiedBy,
    threshold,
    state,
    stateLabel,
  };
}

/**
 * Score a saved run against its own frozen snapshot.
 *
 * Returns null when the run is not an advanced-type run — callers that handle
 * mixed history (the run list, home) use this to skip rows another type owns,
 * rather than every call site re-deriving the type check.
 */
export function scoreSavedRun(run: Run): ScoreResult | null {
  if (run.scorecardSnapshot.content.type !== "advanced") return null;
  if (run.answers.type !== "advanced") return null;
  return scoreRun(run.scorecardSnapshot.content.doc, run.answers.values);
}
