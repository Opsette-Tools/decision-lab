/**
 * Templates for the `forms` type.
 *
 * Every mature product treats the empty state as a failure — iRubric ships a
 * 500,000-rubric gallery, Canvas has "Find a Rubric", and RubiStar's entire
 * value is never facing a blank grid. So a new questionnaire starts from a real
 * one whenever possible.
 *
 * The first template IS the list that motivated this type: the questions asked
 * on a real web-design intake call, written the way they were actually said —
 * a question, and the shapes the answer comes in. Note how many are
 * yes / no / not-sure, which is why there is no separate "yes/no" kind.
 *
 * Ids are minted fresh at pick time (see `instantiate`), so two scorecards made
 * from the same template never share question or option ids.
 */

import { uuid } from "@/lib/uuid";
import type { ScorecardContent, Threshold } from "@/db/types";
import type { FormsDoc, FormsOption, FormsQuestion, QuestionKind } from "./model";

/** A template's shape before ids exist. */
interface TemplateOption {
  label: string;
  points?: number;
}

interface TemplateQuestion {
  kind: QuestionKind;
  label: string;
  description?: string;
  required?: boolean;
  options?: TemplateOption[];
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string; maxPoints?: number };
}

export interface FormsTemplate {
  key: string;
  name: string;
  /** One line for the picker. What this questionnaire is for. */
  blurb: string;
  scored: boolean;
  questions: TemplateQuestion[];
  thresholds: Array<Omit<Threshold, "id">>;
}

export const FORMS_TEMPLATES: FormsTemplate[] = [
  {
    key: "web-client-intake",
    name: "New website client intake",
    blurb: "The questions you ask before quoting a site build.",
    scored: true,
    questions: [
      { kind: "section", label: "What the site needs to do" },
      {
        kind: "choice",
        label: "Are you selling online, or is this a brochure site?",
        options: [
          { label: "Selling online", points: 3 },
          { label: "Brochure only, for now", points: 2 },
          { label: "Not sure yet", points: 0 },
        ],
        required: true,
      },
      {
        kind: "checkboxes",
        label: "What does the site need to handle?",
        description: "Everything that applies.",
        options: [
          { label: "Take payments", points: 2 },
          { label: "Book appointments", points: 1 },
          { label: "Collect enquiries", points: 1 },
          { label: "Show a catalog", points: 1 },
          { label: "Not sure yet", points: 0 },
        ],
      },
      {
        kind: "choice",
        label: "Can you describe what you sell?",
        description: "Photos, a product list, a catalog. Something concrete.",
        options: [
          { label: "Detailed, with photos or a catalog", points: 3 },
          { label: "Rough idea, nothing written down", points: 1 },
          { label: "Can't describe it yet", points: 0 },
        ],
        required: true,
      },

      { kind: "section", label: "Logistics" },
      {
        kind: "choice",
        label: "Where will you ship to?",
        options: [
          { label: "US only", points: 3 },
          { label: "Europe only", points: 3 },
          { label: "Worldwide", points: 2 },
          { label: "Not sure yet", points: 0 },
        ],
      },
      {
        kind: "choice",
        label: "Who ships the orders?",
        options: [
          { label: "You do", points: 3 },
          { label: "Your vendors ship direct", points: 2 },
          { label: "Not sure yet", points: 0 },
        ],
      },
      {
        kind: "choice",
        label: "Do you have a domain?",
        options: [
          { label: "Owns it already", points: 3 },
          { label: "Chosen but not purchased", points: 1 },
          { label: "Hasn't thought about it", points: 0 },
        ],
      },

      { kind: "section", label: "Business setup" },
      {
        kind: "choice",
        label: "Do you have a payment processor set up, like Stripe, PayPal, or Square?",
        options: [
          { label: "Yes", points: 3 },
          { label: "No", points: 1 },
          { label: "Not sure yet", points: 0 },
        ],
      },
      {
        kind: "choice",
        label: "Is there a business account for the money to land in?",
        options: [
          { label: "Set up and active", points: 3 },
          { label: "In progress", points: 1 },
          { label: "Nothing yet", points: 0 },
        ],
      },
      {
        kind: "choice",
        label: "Is the budget a real number?",
        description: "A range counts. Dodging it twice is its own answer.",
        options: [
          { label: "Stated a number", points: 3 },
          { label: "Gave a range", points: 2 },
          { label: "Evasive about money", points: 0 },
        ],
      },
      {
        kind: "scale",
        label: "How ready are you to start?",
        scale: { min: 1, max: 5, minLabel: "Just exploring", maxLabel: "Ready now", maxPoints: 3 },
      },
      {
        kind: "text",
        label: "Anything else worth noting?",
        description: "Captured with the run, never scored.",
      },
    ],
    thresholds: [
      { min: 70, label: "Ready to build", tone: "pass" },
      { min: 40, label: "Needs groundwork", tone: "warn" },
      { min: 0, label: "Not ready yet", tone: "fail" },
    ],
  },
];

/** Turn a template into a real, id-bearing payload ready for the repo. */
export function instantiate(template: FormsTemplate): {
  name: string;
  content: ScorecardContent;
} {
  const questions: FormsQuestion[] = template.questions.map((q) => ({
    id: uuid(),
    kind: q.kind,
    label: q.label,
    description: q.description,
    required: q.required,
    options: (q.options ?? []).map((o): FormsOption => ({ ...o, id: uuid() })),
    scale: q.scale ? { ...q.scale } : undefined,
  }));
  const thresholds: Threshold[] = template.thresholds.map((t) => ({ ...t, id: uuid() }));
  const doc: FormsDoc = {
    questions,
    scored: template.scored,
    thresholds,
    scoreInversion: "earned",
    scoreDisplay: "percent",
  };
  return { name: template.name, content: { type: "forms", doc } };
}

/** The bands a blank questionnaire starts with. */
export function defaultFormsThresholds(): Threshold[] {
  return [
    { id: uuid(), min: 70, label: "Ready to build", tone: "pass" },
    { id: uuid(), min: 40, label: "Needs groundwork", tone: "warn" },
    { id: uuid(), min: 0, label: "Not ready yet", tone: "fail" },
  ];
}
