/**
 * Templates for the `advanced` type.
 *
 * Deliberately ONE. A weighted rubric with per-answer dealbreakers is a heavy
 * format, and a gallery of six of them makes the library look busy while
 * teaching nothing the first one didn't. This is the real case the format was
 * designed around — the web-design lead from 2026-09-17, where "can't describe
 * their products" ended the conversation and the domain and business-account
 * answers turned into the scope list.
 *
 * Lighter question sets belong to the `forms` type, which is where most
 * checklists should start. See docs/SCORECARD_TYPES.md.
 *
 * Ids are minted fresh at pick time (see `instantiate`), so two scorecards made
 * from the same template never share question or option ids.
 */

import { uuid } from "@/lib/uuid";
import type { ScorecardContent, Threshold } from "@/db/types";
import type { AnswerOption, Criterion } from "./model";

/** A template's shape before ids exist. */
interface TemplateOption {
  label: string;
  value: number;
  disqualifies?: boolean;
  blocks?: boolean;
  blockerNote?: string;
}

interface TemplateCriterion {
  label: string;
  hint?: string;
  weight: number;
  options: TemplateOption[];
}

export interface AdvancedTemplate {
  key: string;
  name: string;
  /** One line for the picker. What decision this is for. */
  blurb: string;
  criteria: TemplateCriterion[];
  thresholds: Array<Omit<Threshold, "id">>;
}

export const ADVANCED_TEMPLATES: AdvancedTemplate[] = [
  {
    key: "web-design-client",
    name: "Web design client fit",
    blurb: "Whether a website or design lead is worth taking on.",
    criteria: [
      {
        label: "Can they describe what they sell?",
        hint: "Photos, a product list, a catalog. Something concrete.",
        weight: 5,
        options: [
          { label: "Detailed, with photos or a catalog", value: 3 },
          { label: "Rough idea, nothing written down", value: 2 },
          { label: "Can't describe it", value: 0, disqualifies: true },
        ],
      },
      {
        label: "Is the budget a real number?",
        hint: "A range counts. Dodging it twice is its own answer.",
        weight: 4,
        options: [
          { label: "Stated a number", value: 3 },
          { label: "Gave a range", value: 2 },
          { label: "Evasive about money", value: 1 },
        ],
      },
      {
        label: "Is there a business account to sell through?",
        hint: "Payments have to land somewhere.",
        weight: 3,
        options: [
          { label: "Set up and active", value: 3 },
          {
            label: "In progress",
            value: 2,
            blocks: true,
            blockerNote: "Business account live before launch",
          },
          {
            label: "Nothing yet",
            value: 1,
            blocks: true,
            blockerNote: "Business account opened before launch",
          },
        ],
      },
      {
        label: "Do they know where they're selling?",
        hint: "Shipping and tax follow from this.",
        weight: 2,
        options: [
          { label: "Specific markets named", value: 3 },
          { label: "One country", value: 2 },
          { label: "Not sure yet", value: 1 },
        ],
      },
      {
        label: "Do they have a domain?",
        weight: 1,
        options: [
          { label: "Owns it already", value: 3 },
          {
            label: "Chosen but not purchased",
            value: 2,
            blocks: true,
            blockerNote: "Domain purchased before handoff",
          },
          {
            label: "Hasn't thought about it",
            value: 1,
            blocks: true,
            blockerNote: "Domain chosen and purchased before handoff",
          },
        ],
      },
    ],
    thresholds: [
      { min: 75, label: "Good fit", tone: "pass" },
      { min: 50, label: "Proceed with care", tone: "warn" },
      { min: 0, label: "Walk away", tone: "fail" },
    ],
  },
];

/** Turn a template into a real, id-bearing payload ready for the repo. */
export function instantiate(template: AdvancedTemplate): {
  name: string;
  content: ScorecardContent;
} {
  const criteria: Criterion[] = template.criteria.map((c) => ({
    id: uuid(),
    label: c.label,
    hint: c.hint,
    weight: c.weight,
    options: c.options.map((o): AnswerOption => ({ ...o, id: uuid() })),
  }));
  const thresholds: Threshold[] = template.thresholds.map((t) => ({ ...t, id: uuid() }));
  return {
    name: template.name,
    content: { type: "advanced", doc: { criteria, thresholds } },
  };
}

/** The bands a blank advanced scorecard starts with. */
export function defaultThresholds(): Threshold[] {
  return [
    { id: uuid(), min: 75, label: "Good fit", tone: "pass" },
    { id: uuid(), min: 50, label: "Proceed with care", tone: "warn" },
    { id: uuid(), min: 0, label: "Walk away", tone: "fail" },
  ];
}
