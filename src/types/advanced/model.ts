/**
 * The `advanced` scorecard type — the original weighted-rubric format.
 *
 * Every question carries its own custom answer scale, and every answer can flag
 * itself as a dealbreaker (ends the decision) or a blocker (must be fixed
 * before delivery). That is real expressive power, and it is genuinely heavy to
 * author: you write the answer set for every single question.
 *
 * It earns that cost on a high-stakes decision you make repeatedly and have
 * strong opinions about. For a quick scored checklist, the `forms` type is the
 * right tool — see docs/SCORECARD_TYPES.md.
 */

import type { Threshold } from "@/db/types";

/** A named question with a graded answer scale and a weight. */
export interface Criterion {
  id: string;
  /** The question as the operator will read it aloud. */
  label: string;
  /** Operator-only note. Never shown to a subject. */
  hint?: string;
  /** 1..5. Constrained on purpose — see WEIGHT_MIN/WEIGHT_MAX below. */
  weight: number;
  /** Order is the array order, not a sort field. */
  options: AnswerOption[];
}

export interface AnswerOption {
  id: string;
  label: string;
  /** Contribution before weighting. Higher is better. */
  value: number;
  /**
   * This answer ends the run, whatever else is true. Short-circuits scoring.
   * Independent of `blocks` — an answer can be either, both, or neither.
   */
  disqualifies?: boolean;
  /**
   * Doesn't kill the decision, but must be resolved before delivery. These
   * accumulate into the run's blocker list, which IS the scope conversation.
   */
  blocks?: boolean;
  /** What has to happen to clear the block. */
  blockerNote?: string;
}

/** Everything an advanced scorecard holds beyond the common Scorecard fields. */
export interface AdvancedDoc {
  criteria: Criterion[];
  /** Sorted descending by `min` on read — see scorecardsRepo. */
  thresholds: Threshold[];
}

export const emptyAdvancedDoc: AdvancedDoc = { criteria: [], thresholds: [] };

/* ---- Constraints ----------------------------------------------------------- */

/**
 * Weights are a constrained 1..5 scale rather than a free number.
 *
 * Unbounded weights let a single criterion silently swamp every other one, and
 * they make percentages stop being comparable between scorecards — which breaks
 * the cross-run comparison that is this tool's product.
 */
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 5;

/** Option values are bounded too, so one option can't out-vote its weight. */
export const VALUE_MIN = 0;
export const VALUE_MAX = 5;
