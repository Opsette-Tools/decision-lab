/**
 * The `forms` scoring engine. Pure, deterministic, dependency-free.
 *
 *   score    = Σ points over ANSWERED, scored questions
 *   maxScore = Σ (max achievable points) over those SAME questions
 *   percent  = round(score / maxScore × 100)
 *
 * Two rules carry over from `advanced` and must never break:
 *
 *   · Skipped questions are excluded from BOTH terms — never scored as zero.
 *     A run is filled in live and out of order, so an unanswered question means
 *     "not asked yet", not "answered badly".
 *   · Nothing answered reads as "not started" (percent === null), not 0%.
 *
 * This is stricter than Opsette's computeScore.ts, which counts a field's
 * `possible` even when unanswered and returns 0% when nothing is possible. That
 * is correct for a submitted form, where everyone answers everything at once,
 * and wrong for a run that is filled in during a conversation.
 *
 * There are no blockers and no dealbreakers here. They belong to `advanced`,
 * and leaving them out is most of why this type exists.
 */

import type { FormsAnswerValue, Run, Threshold, VerdictTone } from "@/db/types";
import type { FormsDoc, FormsOption, FormsQuestion } from "./model";

/** Kinds that carry an options list and can be scored from it. */
const OPTION_KINDS = new Set(["choice", "checkboxes", "dropdown"]);

/** Whether a question can contribute to the score at all. */
export function isScorable(question: FormsQuestion): boolean {
  if (question.kind === "text" || question.kind === "section") return false;
  if (question.kind === "scale") return true;
  return OPTION_KINDS.has(question.kind);
}

/**
 * Points an option is worth. An option with no `points` set contributes
 * nothing rather than being treated as missing data — "unscored option" and
 * "zero-point option" are the same thing to the arithmetic.
 */
function optionPoints(option: FormsOption): number {
  return option.points ?? 0;
}

/**
 * The most a question could contribute if answered as well as possible.
 *
 * Mirrors Opsette's computeScore, which gets this right: the highest SINGLE
 * option for single-select kinds, and the sum of every POSITIVE option for
 * checkboxes (a negative option is a penalty, so counting it into the ceiling
 * would make a perfect answer unreachable).
 */
export function maxPointsFor(question: FormsQuestion): number {
  if (!isScorable(question)) return 0;

  if (question.kind === "scale") {
    return question.scale?.maxPoints ?? 0;
  }

  if (question.kind === "checkboxes") {
    return question.options.reduce((sum, o) => sum + Math.max(0, optionPoints(o)), 0);
  }

  // choice / dropdown: one answer, so the ceiling is the best single option.
  return question.options.reduce((best, o) => Math.max(best, optionPoints(o)), 0);
}

/**
 * Points a `scale` answer earns, interpolated across the scale's own range.
 *
 * `(value - min) / (max - min) × maxPoints`, NOT `value / max × maxPoints`.
 * The scale's floor is author-settable, and a 1..5 scale answered 1 is the
 * worst available answer — it must be worth zero. Dividing by `max` alone would
 * award it 20%, so the bottom of the scale would never be the bottom of the
 * score. Interpolating across the range is also what "a label at each end"
 * implies: minLabel is nothing earned, maxLabel is everything.
 *
 * The author never enters a point value per step; that per-step grind is
 * exactly what this type exists to remove.
 */
export function scalePoints(question: FormsQuestion, value: number): number {
  const scale = question.scale;
  if (!scale) return 0;
  const maxPoints = scale.maxPoints ?? 0;
  const span = scale.max - scale.min;
  // A degenerate one-point scale can't interpolate; answering it at all earns
  // the full value rather than dividing by zero.
  if (span <= 0) return maxPoints;
  const clamped = Math.min(Math.max(value, scale.min), scale.max);
  return ((clamped - scale.min) / span) * maxPoints;
}

/** One question's contribution, kept so the run can show its arithmetic. */
export interface FormsLineItem {
  question: FormsQuestion;
  /** True when the question has an answer recorded. */
  answered: boolean;
  /** Option labels chosen, the scale value, or the text entered. */
  display: string;
  /** Points earned. 0 for skipped and for unscorable kinds. */
  points: number;
  /** The best this question could have contributed. 0 when skipped. */
  maxPoints: number;
}

export interface FormsScoreResult {
  /** Points earned across answered, scored questions. */
  score: number;
  /** Points available across those same questions. */
  maxScore: number;
  /**
   * The number to SHOW. Equals `score`, or `maxScore - score` when the doc sets
   * `scoreInversion: "remaining"`. Thresholds never consult this — see below.
   */
  displayScore: number;
  /** 0..100 from the RAW score. Null when nothing scorable is answered. */
  percent: number | null;
  /** Questions with an answer, and how many exist that could take one. */
  answeredCount: number;
  totalCount: number;
  /** Per-question breakdown, in document order, including skipped ones. */
  lineItems: FormsLineItem[];
  /** The band `percent` falls into, or null when unscored. */
  threshold: Threshold | null;
  /** The single state the whole surface takes on. */
  state: VerdictTone;
  /** The threshold's label, or a fixed string. */
  stateLabel: string;
  /** False when the doc has scoring switched off — the run is a checklist. */
  scored: boolean;
}

/**
 * Pick the band a percentage falls into: the highest `min` it meets or exceeds.
 * Thresholds need not arrive sorted. Same rule as `advanced`.
 */
export function thresholdFor(thresholds: Threshold[], percent: number): Threshold | null {
  let best: Threshold | null = null;
  for (const t of thresholds) {
    if (percent >= t.min && (best === null || t.min > best.min)) best = t;
  }
  return best;
}

/** Whether a recorded value counts as an answer. */
function hasAnswer(value: FormsAnswerValue | undefined): value is FormsAnswerValue {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return Number.isFinite(value);
}

/** What the breakdown shows for a question's answer. */
function describeAnswer(question: FormsQuestion, value: FormsAnswerValue | undefined): string {
  if (!hasAnswer(value)) return "";
  if (question.kind === "text") return String(value);
  if (question.kind === "scale") return String(value);

  const ids = Array.isArray(value) ? value : [String(value)];
  const labels = ids
    .map((id) => question.options.find((o) => o.id === id))
    .filter((o): o is FormsOption => o !== undefined)
    .map((o) => o.label.trim() || "—");
  return labels.join(", ");
}

/**
 * Score a set of answers against a forms doc.
 *
 * `answers` maps questionId -> value: an option id for choice/dropdown, an
 * array of option ids for checkboxes, a number for a scale, a string for text.
 * Unrecognized option ids are ignored rather than throwing, so a run whose
 * snapshot lost an option still renders instead of crashing the page.
 */
export function scoreForms(
  doc: FormsDoc,
  answers: Record<string, FormsAnswerValue>,
): FormsScoreResult {
  const lineItems: FormsLineItem[] = [];
  let score = 0;
  let maxScore = 0;
  let answeredCount = 0;
  let totalCount = 0;

  for (const question of doc.questions) {
    // A section is a divider, not a question. It is never answered, never
    // scored, and never counted toward "3 of 8 answered".
    if (question.kind === "section") {
      lineItems.push({ question, answered: false, display: "", points: 0, maxPoints: 0 });
      continue;
    }

    totalCount += 1;
    const value = answers[question.id];
    const answered = hasAnswer(value);

    if (!answered) {
      // Skipped: contributes to neither term. Recorded so the breakdown can
      // show it as deliberately unanswered rather than omitting the row.
      lineItems.push({ question, answered: false, display: "", points: 0, maxPoints: 0 });
      continue;
    }

    answeredCount += 1;

    // Unscorable kinds (text) are captured and never judged — they count as
    // answered, and contribute nothing to either scoring term.
    if (!isScorable(question) || !doc.scored) {
      lineItems.push({
        question,
        answered: true,
        display: describeAnswer(question, value),
        points: 0,
        maxPoints: 0,
      });
      continue;
    }

    let points = 0;
    if (question.kind === "scale") {
      points = typeof value === "number" ? scalePoints(question, value) : 0;
    } else if (question.kind === "checkboxes") {
      // Points SUM across every checked option, so an "all of the above"
      // question can out-score a single-select one. That is the author's call
      // to make, and the header total is what makes it visible.
      const ids = Array.isArray(value) ? value : [];
      for (const id of ids) {
        const option = question.options.find((o) => o.id === id);
        if (option) points += optionPoints(option);
      }
    } else {
      const option = question.options.find((o) => o.id === String(value));
      points = option ? optionPoints(option) : 0;
    }

    const maxPoints = maxPointsFor(question);
    score += points;
    maxScore += maxPoints;
    lineItems.push({
      question,
      answered: true,
      display: describeAnswer(question, value),
      points,
      maxPoints,
    });
  }

  // Percent is null (not 0) until something scorable is answered, and guarded
  // against a zero denominator — a run whose answered questions all top out at
  // zero points has no meaningful percentage to report.
  const percent =
    !doc.scored || maxScore === 0 ? null : Math.round((score / maxScore) * 100);

  // Inversion changes the DISPLAYED number only. Threshold matching below still
  // uses the raw percent, so toggling it never silently re-buckets anyone —
  // that is the detail that makes Opsette's version well designed, and it is
  // preserved exactly.
  const displayScore = doc.scoreInversion === "remaining" ? maxScore - score : score;

  const threshold = percent === null ? null : thresholdFor(doc.thresholds, percent);

  let state: VerdictTone;
  let stateLabel: string;
  if (!doc.scored) {
    state = "warn";
    stateLabel = answeredCount === 0 ? "Not started" : `${answeredCount} of ${totalCount} answered`;
  } else if (percent === null) {
    state = "warn";
    stateLabel = "Not started";
  } else if (threshold) {
    state = threshold.tone;
    stateLabel = threshold.label;
  } else {
    // A percent exists but sits below every band's floor.
    state = "fail";
    stateLabel = "Below range";
  }

  return {
    score,
    maxScore,
    displayScore,
    percent,
    answeredCount,
    totalCount,
    lineItems,
    threshold,
    state,
    stateLabel,
    scored: doc.scored,
  };
}

/**
 * The total a fully-answered run would score — the "Total points" the editor
 * shows in its header while authoring, before any run exists.
 */
export function totalPossible(doc: FormsDoc): number {
  return doc.questions.reduce((sum, q) => sum + maxPointsFor(q), 0);
}

/**
 * Score a saved run against its own frozen snapshot.
 *
 * Returns null when the run is not a forms-type run, so callers that handle
 * mixed history skip rows another type owns rather than re-deriving the check.
 */
export function scoreSavedFormsRun(run: Run): FormsScoreResult | null {
  if (run.scorecardSnapshot.content.type !== "forms") return null;
  if (run.answers.type !== "forms") return null;
  return scoreForms(run.scorecardSnapshot.content.doc, run.answers.values);
}
