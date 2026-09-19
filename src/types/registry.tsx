import { ExperimentOutlined, FormOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import type { Scorecard, ScorecardContent, ScorecardType } from "@/db/types";
import { emptyAdvancedDoc } from "@/types/advanced/model";
import { emptyFormsDoc } from "@/types/forms/model";

/**
 * The scorecard type registry.
 *
 * One entry per kind of scorecard Decision Lab can make. This is the ONLY file
 * that needs a new entry when a type is added — the chooser, the library badges
 * and the editor route all read from here, so nothing else has to grow a
 * switch statement.
 *
 * Modelled on SmartFlow's diagramTypes, which has held up across six diagram
 * kinds without the pages needing to know about any of them individually.
 */

export interface ScorecardTypeInfo {
  id: ScorecardType;
  name: string;
  /** One line for the chooser card. What decision shape this type is for. */
  blurb: string;
  /** Longer copy, shown under the blurb in the chooser. */
  detail: string;
  icon: ReactNode;
  /** False while a type is defined but its editor is not built yet. */
  ready: boolean;
  /** A fresh, empty payload for a newly created scorecard of this type. */
  emptyContent: () => ScorecardContent;
}

export const SCORECARD_TYPES: ScorecardTypeInfo[] = [
  {
    id: "forms",
    name: "Questionnaire",
    blurb: "A list of questions with answer choices, scored if you want.",
    detail:
      "Pick a question type for each line — multiple choice, checkboxes, a dropdown, a 1-5 scale, or plain text. Add points to turn it into a scorecard, or leave them off and use it as a structured checklist.",
    icon: <FormOutlined />,
    ready: false,
    emptyContent: () => ({ type: "forms", doc: structuredClone(emptyFormsDoc) }),
  },
  {
    id: "advanced",
    name: "Weighted rubric",
    blurb: "Every question gets its own answer scale, weight, and dealbreakers.",
    detail:
      "Built for a decision you make often and have strong opinions about. You write the answers you actually hear for each question, weight the questions against each other, and mark the answers that end the conversation or have to be fixed before you deliver. More to set up, and it holds far more of your judgment.",
    icon: <ExperimentOutlined />,
    ready: true,
    emptyContent: () => ({ type: "advanced", doc: structuredClone(emptyAdvancedDoc) }),
  },
];

const BY_ID = new Map(SCORECARD_TYPES.map((t) => [t.id, t]));

export function typeInfo(id: ScorecardType): ScorecardTypeInfo {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown scorecard type: ${id}`);
  return found;
}

/** Narrowing helpers, so pages assert the shape once instead of everywhere. */
export function isAdvanced(
  scorecard: Scorecard,
): scorecard is Scorecard & { content: Extract<ScorecardContent, { type: "advanced" }> } {
  return scorecard.content.type === "advanced";
}

export function isForms(
  scorecard: Scorecard,
): scorecard is Scorecard & { content: Extract<ScorecardContent, { type: "forms" }> } {
  return scorecard.content.type === "forms";
}
