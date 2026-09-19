/**
 * The `forms` scorecard type — a Google Forms-shaped scored questionnaire.
 *
 * NOT BUILT YET. This file defines the data shape only, so the type spine,
 * repo, and router can be wired for it now and a later session can build the
 * editor and run screen into a prepared slot rather than fighting the
 * structure. See docs/FORMS_TYPE_SPEC.md for the full spec.
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
    /** Points awarded at `max`; intermediate points interpolate. */
    maxPoints?: number;
  };
}

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
}

export const emptyFormsDoc: FormsDoc = { questions: [], scored: true, thresholds: [] };
