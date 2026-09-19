# Forms type — build spec

**Status:** not built. Model and registry slot exist; editor and run screen are
this doc's job.
**Written:** 2026-09-18 · **Owner:** Ruthnie
**Type id:** `forms` · **Display name:** Questionnaire

Read `SCORECARD_TYPES.md` first — it covers the type spine, the folder contract
and the research this rests on.

---

## What it is

A **Google Forms-shaped scored questionnaire**. Questions have *types*. Most
questions are one line of text plus a type; only the ones that need custom
options get them. Scoring is opt-in, exactly like turning a Google Form into a
quiz.

This is the type most scorecards should be. It exists because `advanced`
over-serves the common case — see below.

## Why it exists (do not lose this)

The `advanced` type asks you to hand-write an answer set for every question.
For an eighteen-question client intake that is eighteen bespoke answer sets, and
authoring collapses under it.

But the questions themselves already carry their answers. Here is a real intake
list, written naturally:

> Where will you ship to? **(US only, Europe only, worldwide, not sure yet)**
> Do you have a payment processor set up, like Stripe, PayPal, or Square? **(yes, no, not sure yet)**
> Who ships the orders? **(you, your vendors ship direct, not sure yet)**

The answers are in parentheses, written without effort, because that is how you
ask a question when you know the shapes the answer comes in. **The concept was
never wrong — the authoring UI was.** The job of this type is to make writing a
question feel like writing that line.

Note also how many of those are `yes / no / not sure` — which is why there is no
separate "yes/no" question type. That is a `choice` question with three options.
Minting a type per option-count is how you end up with fifteen types that are
all the same type.

---

## Question types

Mirrors Google Forms, minus what does not serve scoring.

| kind | What it is | Scored? |
|---|---|---|
| `choice` | Radio. Single select, options listed. | Yes |
| `checkboxes` | Multi select. Several answers can be true at once. | Yes |
| `dropdown` | Single select, collapsed. Same data as `choice`, different presentation. | Yes |
| `scale` | A 1..N run of numbered points, labels at each end. | Yes |
| `text` | Free text. Captured, never judged. | No |
| `section` | A visual divider with a title and optional blurb. | No |

**Grids (multiple-choice grid / checkbox grid) are deliberately deferred.** They
are the least mobile-survivable control in Forms, and the run screen has to work
on a phone. Revisit only if a real need appears.

**On `checkboxes` scoring:** points sum across every checked option. An "all of
the above" question can therefore out-score a single-select one — that is the
author's call to make, not something to prevent, but the running total in the
editor must make it visible.

**On `scale` scoring:** `maxPoints` is awarded at `scale.max`, and intermediate
points interpolate linearly. Do not make the author enter a point value per
scale step; that is the authoring burden this type exists to remove.

---

## The data model

Already written — `src/types/forms/model.ts`. Summary:

```ts
FormsDoc {
  questions: FormsQuestion[];
  scored: boolean;          // the "make it a quiz" switch
  thresholds: Threshold[];  // only consulted when scored
}

FormsQuestion {
  id, kind, label, description?, required?,
  options: FormsOption[],   // choice / checkboxes / dropdown
  scale?: { min, max, minLabel?, maxLabel?, maxPoints? }
}

FormsOption { id, label, points? }
```

Run answers are `{ type: "forms", values: Record<questionId, string | string[] | number> }`
— a string for single-select, an array for checkboxes, a number for a scale.

---

## Authoring UX — the part that matters

The previous editor failed on **sequence and hierarchy**, not wording. Four
sections at identical width, nothing claiming the eye, instructional sentences
where labels belonged. Do not repeat it.

### Rules

1. **A question is a card. Collapsed by default.** Collapsed shows the question
   text, its kind, and its points. Expanded shows everything else. Eighteen
   expanded panels is an unreadable wall.
2. **The question text is primary.** Largest thing in the card, always visible.
3. **Points are a small number box, top-right.** One number, always visible when
   `scored` is on, never a slider. (Google Forms puts it exactly here.)
4. **The kind picker is a dropdown at the card's top-right,** beside points.
   Changing kind preserves the label and options where they still apply.
5. **Per-option points are progressive disclosure.** Hidden behind one reveal per
   question, the way Forms hides them behind "Answer key". Default behaviour
   with points on and nothing customised: first option full points, others zero.
   The author overrides only where it matters.
6. **Options are one compact row each** — label, points (when revealed), delete.
   Not a bordered panel per option.
7. **Plain noun labels.** "Question", "Description", "Points", "Options",
   "Required". No instructional sentences, no coaching, **no em dashes in UI
   copy**.
8. **A running total, always visible** while authoring. Every mature tool shows
   it; ours did not.
9. **Fast entry matters more than any bulk-edit feature.** Enter at the end of an
   option row adds the next option. Enter on the question label opens options.
   Duplicate-question is the real speed tool (Canvas, Lever both ship it).

### The comma-paste affordance (worth building)

Because people write answers inline, accept a pasted or typed comma-separated
line and split it into options:

```
US only, Europe only, worldwide, not sure yet
```

This is the single interaction that would have made the original editor feel
like the list it was trying to capture. Offer it on an empty options list; never
force it.

### Section questions

`section` exists because real intake lists have headings — "What the site needs
to do", "Logistics", "Business setup". It renders as a divider in the editor and
a real break in the run screen, and it is never scored. It is the cheap way to
give an eighteen-question run some structure.

---

## Run UX

Reuse what already works in `advanced/AdvancedRun.tsx` — the pinned verdict, the
sticky-on-mobile behaviour, write-through-on-tap persistence, and the tokens in
`verdict.css`. The verdict panel is type-agnostic apart from blockers.

Differences:

- **No blockers and no dealbreakers in this type.** They belong to `advanced`.
  Do not port them in; that complexity is what `forms` exists to avoid.
- **Sections break the question list** into labelled groups.
- **`required` questions** must be answered before Finish; everything else
  remains skippable, and skipped stays excluded from both scoring terms.
- **Unscored mode** (`scored: false`) hides the verdict entirely — the run is a
  structured checklist that records answers without judging them.

---

## Scoring

```
score    = Σ points over answered, scored questions
maxScore = Σ (max achievable points) over those same questions
percent  = round(score / maxScore × 100)
```

Same discipline as `advanced`, and the same two rules that must not break:

- **Skipped questions are excluded from BOTH terms.** Never scored as zero.
- **Nothing answered reads as "not started", not 0%.**

Write it as `src/types/forms/score.ts`, pure and dependency-free, and add cases
to `scripts/verify-scoring.mjs` the same way — a standalone reimplementation, so
that a drift between spec and engine fails loudly.

---

## Templates

Ship at least one, built from the real client-intake list (it is in the
2026-09-18 session transcript; sections: *What the site needs to do*,
*Logistics*, *Business setup*). Every mature product treats the empty state as a
failure.

Templates live in `src/types/forms/templates.ts` and are picked up automatically
by `TemplatePicker` — extend the `type === "advanced"` branch there to include
forms templates.

---

## Definition of done

- [ ] `src/types/forms/score.ts` + verification cases in `scripts/verify-scoring.mjs`
- [ ] `FormsEditor.tsx` + components, honouring the nine authoring rules above
- [ ] `FormsRun.tsx`, including unscored mode and sections
- [ ] At least one template
- [ ] `EditorRoute` / `RunRoute` `forms` branches point at the real screens
- [ ] `ready: true` in `types/registry.tsx`
- [ ] Typechecks (`npx tsc --noEmit`) and works at 375px

## Before building — compare against Opsette's own form builder

Ruthnie has a form builder in the parent app (Opsette). **Look at it before
building this**, and mirror what works there rather than inventing a second
pattern for the same job. Two form builders in one product family that behave
differently is worse than either one alone.
