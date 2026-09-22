/**
 * The `forms` scorecard type — a Google Forms-shaped scored questionnaire.
 *
 * See docs/FORMS_TYPE_SPEC.md for the full spec and the reasoning behind each
 * divergence from Opsette's own form builder.
 *
 * The idea: questions have TYPES, the way Forms does. Most are one line of text
 * plus a type; only the ones that need custom options get them. That is what
 * makes authoring light — the opposite of `advanced`, where every question
 * needs its own hand-written answer set.
 */

/**
 * Question kinds, mirroring Google Forms.
 *
 * Note what is NOT here: there is no separate "yes/no" or "yes/maybe/no" type.
 * Those are `choice` questions with two or three options. Minting a type per
 * option-count is how you end up with fifteen types that are all the same type.
 */
export type QuestionKind =
  /** Radio. Single select, one option per row. */
  | "choice"
  /** Multi select. Several answers can be true at once. */
  | "checkboxes"
  /** Single select, collapsed. Same data as `choice`, different presentation. */
  | "dropdown"
  /** A 1..N run of numbered points with labels at each end. */
  | "scale"
  /** Free text. Captured, never scored. */
  | "text"
  /** A visual divider with a title and optional blurb. Never scored. */
  | "section";

export interface FormsOption {
  id: string;
  label: string;
  /** Points this option contributes. Absent on an unscored question. */
  points?: number;
}

export interface FormsQuestion {
  id: string;
  kind: QuestionKind;
  /** The question itself. For `section`, this is the section title. */
  label: string;
  /** Optional supporting line under the question. */
  description?: string;
  /** Answering is required before a run can be finished. */
  required?: boolean;
  /** Options for choice / checkboxes / dropdown. Empty for other kinds. */
  options: FormsOption[];
  /** Scale bounds and end labels. Only meaningful when kind === "scale". */
  scale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
    /**
     * Points awarded at `max`. Intermediate points interpolate across the
     * scale's own range — `(value - min) / (max - min) × maxPoints` — so
     * answering at `min` earns zero. Dividing by `max` alone would make the
     * bottom of a 1..5 scale worth 20%, and the scale's floor has to be the
     * score's floor. See score.ts `scalePoints`.
     */
    maxPoints?: number;
  };
}

/**
 * How the run screen displays the points earned.
 *
 * `earned` shows the raw score. `remaining` shows `possible - raw` instead,
 * for a diagnostic questionnaire where every scored option is a PAIN POINT
 * rather than a merit — fewer selected means a higher displayed number. Most
 * client-intake questions are risk flags, not merits, so this earns its place.
 *
 * The critical rule, preserved from Opsette: threshold matching ALWAYS uses the
 * raw score. Inversion changes the displayed number and nothing else, so
 * toggling it can never silently re-bucket a past run.
 */
export type ScoreInversion = "earned" | "remaining";

/** Whether the run shows a percentage, a raw point count, or no number. */
export type ScoreDisplay = "percent" | "number" | "off";

/** Everything a forms scorecard holds beyond the common Scorecard fields. */
export interface FormsDoc {
  questions: FormsQuestion[];
  /**
   * Scoring is opt-in, exactly like turning a Google Form into a quiz. Off, the
   * scorecard is a structured checklist that records answers without judging
   * them; on, points and bands apply.
   */
  scored: boolean;
  /** Score bands. Only consulted when `scored` is true. */
  thresholds: import("@/db/types").Threshold[];
  /** Defaults to "earned" when absent. */
  scoreInversion?: ScoreInversion;
  /** Defaults to "percent" when absent. */
  scoreDisplay?: ScoreDisplay;
}

export const emptyFormsDoc: FormsDoc = {
  questions: [],
  scored: true,
  thresholds: [],
  scoreInversion: "earned",
  scoreDisplay: "percent",
};

/* ---- Constraints ----------------------------------------------------------- */

/**
 * Scale bounds. A linear scale wider than 1..10 stops being readable as a row
 * of tap targets on a phone, which is the control's whole job — Google Forms
 * caps at 10 for the same reason.
 */
export const SCALE_MIN_FLOOR = 0;
export const SCALE_MAX_CEILING = 10;

/** The scale a fresh `scale` question starts on. */
export const DEFAULT_SCALE = { min: 1, max: 5, maxPoints: 5 } as const;

/** Kinds that carry an options list, and therefore share one options editor. */
export const OPTION_KINDS: QuestionKind[] = ["choice", "checkboxes", "dropdown"];

/** Whether this kind takes an answer at all. A section never does. */
export function takesAnswer(kind: QuestionKind): boolean {
  return kind !== "section";
}

/**
 * Split a pasted blob into option labels.
 *
 * Ported from Opsette's `parsePastedOptions` (FieldConfigurator.tsx ~line 120),
 * minus the value-slugging: options here are keyed by a minted id, not by a
 * slug of their text, so two labels can never collide and a rename can never
 * orphan a score. That is the whole reason `points` lives on the option.
 *
 * Splits on newlines AND commas, because this is the interaction that makes
 * authoring feel like the intake list it came from:
 *
 *   US only, Europe only, worldwide, not sure yet   ->   four options
 *
 * Deduped case-insensitively against what is already there, so pasting the same
 * blob twice does not double the list.
 */
export function parsePastedOptions(raw: string, existingLabels: readonly string[] = []): string[] {
  const seen = new Set(existingLabels.map((l) => l.trim().toLowerCase()));
  const result: string[] = [];
  for (const piece of raw.split(/[\n,]/)) {
    const label = piece.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/** One question recovered from a pasted list, before it is given an id. */
export interface ParsedQuestion {
  label: string;
  /** Answers found in trailing parentheses. Empty when none were written. */
  options: string[];
}

/**
 * Split a pasted blob into whole QUESTIONS, one per line.
 *
 * The sibling of `parsePastedOptions`, and the reason both exist: writing a
 * questionnaire one card at a time is the same grind as writing one option at a
 * time, one level up. Paste the list you already have and configure the types
 * afterward.
 *
 * Splits on NEWLINES ONLY — unlike the options parser, because a question very
 * often contains a comma ("Do you have a processor, like Stripe or Square?")
 * and splitting on it would shred the question into fragments.
 *
 * It also reads answers out of TRAILING PARENTHESES, which is how the questions
 * get written naturally when you know the shapes the answer comes in:
 *
 *   Where will you ship to? (US only, Europe only, worldwide)
 *     -> label "Where will you ship to?", three options
 *
 * Only a trailing group counts, so a parenthetical mid-question ("like Stripe
 * or Square") stays part of the text where it belongs. A line with no trailing
 * group is simply a question with no answers written yet.
 *
 * Leading list markers are stripped, so a numbered or bulleted list pasted out
 * of a doc does not arrive with "1." welded to every question.
 */
export function parsePastedQuestions(raw: string): ParsedQuestion[] {
  const result: ParsedQuestion[] = [];
  for (const line of raw.split(/\r?\n/)) {
    // "1. ", "12) ", "- ", "* ", "• " — the shapes a pasted list arrives in.
    const cleaned = line.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!cleaned) continue;

    const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(cleaned);
    if (match && match[1].trim() && match[2].trim()) {
      result.push({
        label: match[1].trim(),
        options: parsePastedOptions(match[2]),
      });
      continue;
    }
    result.push({ label: cleaned, options: [] });
  }
  return result;
}
