# Decision Lab — scorecard types

**Written:** 2026-09-18 · **Owner:** Ruthnie

Decision Lab is a **lab**: it holds several kinds of scorecard, the way SmartFlow
holds swimlane / flowchart / org chart. You pick a type when you create one, and
the editor, run screen and scoring follow from that.

This doc is the registry of types — what exists, what is planned, and the rules
for adding one. It supersedes the single-format assumption in
`DECISION_LAB_PLAN.md` §1–§8, which describes only the `advanced` type.

---

## Why more than one type

The original build had one format — a weighted rubric where every question
carries its own hand-written answer scale plus dealbreaker and blocker flags.
It is powerful and it is **heavy to author**: five fields deep per question, and
you write the answer set for every single one.

That is the right shape for a decision you make often and have strong opinions
about. It is the wrong shape for "here are eighteen questions I ask a new web
client", which is most of what anyone actually wants to write down.

Cross-industry research (2026-09-18, full findings in §"Research" below)
confirmed the instinct: **no mature tool asks you to author a custom answer set
per question.** Rating scales are defined once and inherited; question *types*
are what vary. Google Forms, Greenhouse, Workable, Canvas and every
decision-matrix template converge on this.

So: one type is not a product. The type spine is.

---

## The types

| id | Name | Status | What it's for |
|---|---|---|---|
| `forms` | Questionnaire | **Not built** — model + slot only | A list of typed questions with optional points. The default for most scorecards. |
| `advanced` | Weighted rubric | **Built** | Per-question answer scales, weights, dealbreakers and blockers. For a high-stakes decision made repeatedly. |

### `advanced` — weighted rubric

The original format, kept intact. See `DECISION_LAB_PLAN.md` for its full
design, and §11 of that doc for what shipped.

- Every question has its own answer options, each with a point value
- Weight 1–5 per question; `score = Σ (answerValue × weight)` over answered questions
- Skipped questions are excluded from **both** terms — never scored as zero
- Any answer flagged `disqualifies` overrides the percentage entirely
- Answers flagged `blocks` accumulate into a delivery-conditions list
- One template: **Web design client fit** (the real 2026-09-17 case)

**Honest assessment:** it over-serves the common case. It is retained because
the engine is sound, verified (`scripts/verify-scoring.mjs`), and genuinely
better than anything else here for a decision worth that much setup. It should
not be the first thing a new user meets, which is why the chooser lists
`forms` first.

### `forms` — questionnaire

**Not built.** The data model (`src/types/forms/model.ts`) and the registry
entry exist so the spine, repo and router are wired for it; the editor and run
screen are a separate session's work.

Full spec: **`docs/FORMS_TYPE_SPEC.md`**.

---

## How the spine works

```
src/
  db/
    types.ts            Scorecard, Run, the ScorecardType union, bridge payloads
    db.ts               one IDB connection, shared
    scorecardsRepo.ts   type-agnostic CRUD — never reaches into content
    runsRepo.ts         type-agnostic CRUD — answers is a tagged union
  types/
    registry.tsx        THE registry. One entry per type.
    advanced/
      model.ts          AdvancedDoc, Criterion, AnswerOption, constraints
      score.ts          the weighted-sum engine (advanced only)
      templates.ts      advanced templates
      AdvancedEditor.tsx
      AdvancedRun.tsx
      components/       criterion editor, criterion row, threshold editor
      verdict/          verdict panel, blocker list, state pills
    forms/
      model.ts          FormsDoc, FormsQuestion, QuestionKind  (model only)
  pages/
    EditorRoute.tsx     dispatches /scorecards/:id on type
    RunRoute.tsx        dispatches /run/:id on the SNAPSHOT's type
    ScorecardsPage.tsx  the library — every type in one list
    HistoryPage.tsx     run history, grouped by scorecard
    HomePage.tsx
```

**The contract:**

- `Scorecard.content` is a discriminated union on `type`. A scorecard's payload
  shape is entirely that type's business.
- `Run.answers` is likewise a tagged union — `advanced` maps criterionId →
  optionId; `forms` will need arrays for checkboxes and raw values for text.
  Forcing one shape on both would make every consumer defensive.
- `Scorecard.type` is duplicated onto the row (alongside `content.type`) so list
  views can filter and badge without opening the payload. The repo always
  sources it from `content.type`, so the two cannot disagree.
- **The repos never look inside `content`** — with one deliberate exception,
  `reidentify()` in `scorecardsRepo`, which must re-mint nested ids on duplicate
  and therefore has to know each type's nesting.
- Routes are `/scorecards/:id` and `/run/:id` for **every** type. The URL names
  the scorecard, not the format, so links survive a type migration.
- `RunRoute` reads the type from the run's **snapshot**, never the live
  scorecard — a run is scored against the copy it froze at start.

### Adding a type

1. `src/types/<id>/model.ts` — the doc shape and any constraints
2. Add the id to `ScorecardType` and `ScorecardContent` in `db/types.ts`
3. Add a `reidentify()` branch in `scorecardsRepo` and an `emptyAnswers()`
   branch in `runsRepo` (TypeScript's exhaustiveness check will demand both)
4. Add the registry entry in `types/registry.tsx`
5. Build `<Type>Editor.tsx` and `<Type>Run.tsx`; add the two `switch` branches
   in `EditorRoute` / `RunRoute`
6. Flip `ready: true` in the registry

Nothing else needs to change. The library, history and home pages read through
the registry and the tagged unions.

---

## Storage

**IndexedDB**, two stores: `scorecards` and `runs`. Not localStorage — every run
embeds a full scorecard snapshot, which is exactly the growth shape that
silently blows the localStorage quota (this has bitten the family before).

`DB_VERSION` is **2**. The v2 upgrade **drops** the v1 `rubrics` and `runs`
stores rather than migrating them: nothing had shipped, there was no production
data, and a migration written for data that never existed is a liability rather
than a safety net.

The Opsette bridge protocol is unchanged. The parent stores an opaque JSONB blob
and never introspects it, so any type's payload rides along with no parent-side
schema work.

---

## Research that informed this (2026-09-18)

Surveyed: Greenhouse, Lever, Workable, Ashby (ATS scorecards); Submittable,
OpenWater, SurveyMonkey Apply (grant review); Responsive/RFP360, Bonfire
(procurement); Canvas, iRubric, Gradescope, RubiStar (education rubrics);
Google Forms, Jotform, Fillout, Tally, Typeform (scored forms); Airtable,
Notion, Monday (decision matrices).

**Findings that changed the design:**

1. **Shared rating scales dominate.** Workable locks the scale at the *account*
   level deliberately. Google Forms has "Global Quiz Defaults". Every
   decision-matrix template uses one scale for all criteria. Per-question custom
   answers appear mainly in generic form builders, where it is a side effect of
   being a form builder rather than a considered rubric decision.
2. **The hybrid is what ships.** OpenWater offers preset scales (1–3, 1–5, 1–10)
   *plus* a "List" type for per-question custom options. Canvas's newest rubric
   engine moved *toward* per-criterion scales. Shared-by-default with an
   override is the pattern that survives both constraints.
3. **Authoring is migrating out of the grid.** Canvas Enhanced Rubrics edits one
   criterion at a time in a dedicated editor rather than in grid cells. The NxM
   grid does not survive a 375px screen, which our mobile-first rule requires.
4. **Nobody uses a slider for weight.** Not one product surveyed. Sliders lose
   precision and are poor on touch. (Ours did — removed.)
5. **Weight is often not a separate field at all.** Canvas, Submittable and
   Gradescope treat a question's max points *as* its weight. All four ATSs ship
   with no weight field whatsoever — Greenhouse expresses importance by tagging
   which questions matter, not by arithmetic.
6. **Templates are the primary entry point, not a nice-to-have.** iRubric ships
   a 500,000-rubric gallery; Canvas has "Find a Rubric"; RubiStar's entire value
   is never facing an empty grid. Every mature product treats the empty state as
   a failure.
7. **Progressive disclosure is how lightness is achieved.** Google Forms shows
   one number per question and hides per-choice scoring behind an "Answer key"
   link. iRubric hides weights and descriptions behind an "Expanded view"
   checkbox. Fillout hides scoring behind an icon.

**Real label vocabulary in use:** Criterion, Criterion Name, Criterion
Description, Attribute, Rating, Rating Name, Points, Pts, Total Points Possible,
Weight, Weight / Multiplier, Question label, Instructions, Answer key. Plain
nouns. Nobody writes instructional sentences where a label belongs.
