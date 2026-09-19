/**
 * Decision Lab's data model.
 *
 * Decision Lab is a LAB: it holds several kinds of scorecard, the way SmartFlow
 * holds swimlane / flowchart / org chart. A scorecard's `type` decides which
 * editor and which run screen it gets, and what shape its `content` takes.
 * Everything in this file is either (a) common to every type, or (b) the
 * per-type content shapes, kept in a discriminated union on `type`.
 *
 * Two independent collections, not one: **scorecards** are the reusable asset
 * (the thing you build once), **runs** are the history (what you decided, and
 * when). They have different lifecycles — a scorecard is edited for years, a
 * run is written once and then frozen — so they get separate stores.
 *
 * Both use a UUID `id` that doubles as the Opsette bridge `data_id`, so a row
 * can round-trip through the parent with no id remapping.
 *
 * See docs/DECISION_LAB_PLAN.md §3 and §7, and docs/SCORECARD_TYPES.md for the
 * type registry and what is planned for each.
 */

import type { AdvancedDoc } from "@/types/advanced/model";
import type { FormsDoc } from "@/types/forms/model";

/* ---- The type spine -------------------------------------------------------- */

/**
 * Every scorecard kind Decision Lab knows about.
 *
 * `advanced` is the original weighted-rubric format: per-question custom answer
 * scales, per-answer dealbreaker and blocker flags. Powerful, and heavy to
 * author — it earns its complexity on a high-stakes recurring decision and is
 * overkill for a quick checklist.
 *
 * `forms` is the Google Forms-shaped quiz builder: typed questions (multiple
 * choice, checkboxes, dropdown, linear scale, short answer, section) with
 * optional points. Not built yet — see docs/FORMS_TYPE_SPEC.md.
 */
export type ScorecardType = "advanced" | "forms";

/**
 * The per-type payload. A real discriminated union, not a lossy stand-in of one
 * shape by another: an advanced scorecard and a forms scorecard have genuinely
 * unrelated internals, and pretending otherwise is what forces every consumer
 * into defensive optional-chaining.
 */
export type ScorecardContent =
  | { type: "advanced"; doc: AdvancedDoc }
  | { type: "forms"; doc: FormsDoc };

/** The reusable asset: how you decide one kind of thing. */
export interface Scorecard {
  id: string;
  /** Duplicated from `content.type` so a list view can filter and badge rows
   *  without reaching into the payload. Always kept in sync by the repo. */
  type: ScorecardType;
  name: string;
  description?: string;
  content: ScorecardContent;
  createdAt: number;
  updatedAt: number;
}

/* ---- Runs ------------------------------------------------------------------ */

/**
 * One execution of a scorecard against a real situation.
 *
 * `scorecardSnapshot` is NOT optional and NOT a denormalization shortcut. A run
 * must embed a frozen copy of the scorecard it was scored against: editing a
 * scorecard later must never retroactively change what a past run scored, or it
 * silently rewrites history and destroys the comparability that is the entire
 * point of saving runs. Same discipline as an invoice storing its own line
 * items instead of pointing at a live price list.
 */
export interface Run {
  id: string;
  scorecardId: string;
  scorecardSnapshot: Scorecard;
  /** What's being decided about. "Acme Co — website build." */
  subject: string;
  notes?: string;
  /**
   * The answers, in whatever shape the type calls for. Each type owns its own
   * answer format — `advanced` maps criterionId -> optionId; `forms` will need
   * arrays for checkbox questions and raw values for text. Typed per-type at
   * the point of use rather than forced into one shape here.
   */
  answers: RunAnswers;
  startedAt: number;
  /** Set when the operator marks the run finished. Absent = still in progress. */
  completedAt?: number;
}

export type RunAnswers =
  | { type: "advanced"; values: Record<string, string> }
  | { type: "forms"; values: Record<string, FormsAnswerValue> };

/** A forms answer: one choice, several choices, a scale point, or free text. */
export type FormsAnswerValue = string | string[] | number;

/* ---- Verdicts -------------------------------------------------------------- */

/** A score band. The verdict label shown for a given percentage. */
export interface Threshold {
  id: string;
  /** Inclusive floor, as a percentage 0..100. */
  min: number;
  label: string;
  tone: VerdictTone;
}

export type VerdictTone = "pass" | "warn" | "fail";

/* ---- Storage --------------------------------------------------------------- */

export const DB_NAME = "decision-lab";
/**
 * v2 renamed the `rubrics` store to `scorecards` and moved the advanced format
 * under `content`. The upgrade path drops the old store rather than migrating:
 * nothing has shipped, there is no production data, and a migration written for
 * data that never existed is a liability, not a safety net.
 */
export const DB_VERSION = 2;
export const SCORECARDS_STORE = "scorecards";
export const RUNS_STORE = "runs";

/* ---- Bridge payloads ------------------------------------------------------- */

/**
 * What one row sends over the Opsette bridge. The parent stores an opaque JSONB
 * blob and never introspects it, so both shapes ride along with no parent-side
 * schema work.
 *
 * `kind` positively tags BOTH shapes — Decision Lab has no legacy rows, so it
 * can afford a clean discriminated union from day one.
 */
export type BridgedScorecardValue = { kind: "scorecard"; value: Omit<Scorecard, "id"> };
export type BridgedRunValue = { kind: "run"; value: Omit<Run, "id"> };
export type BridgedValue = BridgedScorecardValue | BridgedRunValue;
