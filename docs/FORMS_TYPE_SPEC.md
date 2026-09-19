# Forms type — build spec

**Status:** not built. Model and registry slot exist; editor and run screen are
this doc's job.
**Written:** 2026-09-18 · **Revised:** 2026-09-18 (after reviewing Google Forms
and Opsette's own form builder) · **Owner:** Ruthnie
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
over-serves the common case.

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

## The layout: build in place, like Google Forms

**This is the decision that governs everything else in this doc.**

Google Forms puts the whole editing surface on the question card. No drawer, no
side rail, no modal. From the reference screenshot:

```
┌─────────────────────────────────────────────────────────┐
│                       ⠿ (drag)                          │
│  ┌──────────────────────────┐   ┌────────────────────┐  │
│  │ Untitled Question        │   │ ▦ Checkbox grid  ▾ │  │  ← type picker, top-right
│  └──────────────────────────┘   └────────────────────┘  │
│                                                          │
│    [ the type's own middle section renders here ]        │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│  ☑ Answer key  (0 points)      ⧉  🗑  │ Required ○  ⋮   │
└─────────────────────────────────────────────────────────┘
```

And **"Total points: 0" lives in the page header**, always visible while
authoring.

### What this means concretely

1. **ONE component that morphs — not one per type.** A single `QuestionCard`
   owns the frame (drag handle, label input, type picker, footer bar). Only the
   **middle section** swaps on `kind`. Six sibling components that each re-render
   a label input and a footer is the over-engineering to avoid.
2. **No drawer. No side rail.** Everything is on the card.
3. **The type picker is a plain `Select` at the card's top-right**, beside the
   label. Changing type preserves the label, description and any options that
   still apply.
4. **Scoring hides behind an "Answer key" reveal** in the footer, showing the
   question's current points beside it. Closed, a question is just a question.
   Open, per-option point inputs appear inline in the middle section.
5. **A running total in the page header**, always visible when scoring is on.
6. **A floating add-button** to the right of the focused card adds the next
   question (Google's vertical mini-rail). One click, no menu — it adds a
   `choice` question, and the type picker changes it from there.

### Explicitly NOT doing the Opsette-builder pattern

Opsette's own form builder (`C:\opsette\opsette-v2`) puts quiz configuration in
a separate `QuizDrawer` — fields are authored on the canvas, then scored in a
drawer that pulls them in.

**Do not copy that here.** It exists in Opsette for a historical reason: the form
builder predates quiz mode, so scoring was bolted on as a parallel surface.
Decision Lab has no such history — scoring is native, and splitting it across two
surfaces would mean writing a question in one place and valuing it in another.
Google's inline "Answer key" is the better shape and the one to build.

(Ruthnie's own read of that drawer, 2026-09-18: *"this drawer is kind of a mess"*
and *"maybe I've over-engineered ours"*. Take the ideas, not the structure.)

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

`choice`, `checkboxes` and `dropdown` share one options editor — they differ
only in presentation and in whether selection is single or multi. That is three
of the six kinds served by one middle section, which is most of why the morphing
card works.

**Grids (multiple-choice grid / checkbox grid) are deliberately deferred.** They
are the least mobile-survivable control in Forms, and the run screen has to work
on a phone. Revisit only if a real need appears.

**On `checkboxes` scoring:** points sum across every checked option, so an
"all of the above" question can out-score a single-select one. That is the
author's call to make, not something to prevent — but the header total must make
it visible.

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

### Why points live ON the option (the one divergence from Opsette)

Opsette's builder stores scores in a **separate map keyed by option value**:
`optionScores: Record<string, number>`. Because the key is the option's text
slug, renaming an option breaks the link — so it needs a repair function
(`syncOptionScores` in `FieldConfigurator.tsx`) to remap or drop orphaned keys on
every edit.

Here, `points` is a field **on the option object**, matched by `id`. An id never
changes when a label is edited, so a rename cannot orphan anything and no repair
code is needed. Same capability, one less class of silent bug.

Opsette's design is not wrong for Opsette — a parallel map was the
least-invasive way to add scoring to a field type that already existed. It just
isn't a constraint we inherit.

---

## Worth stealing from Opsette's builder

Three real ideas, all portable without the drawer:

### 1. `parsePastedOptions` — the comma-paste affordance

`FieldConfigurator.tsx` ~line 120. Splits a pasted blob on **newlines and
commas**, trims, slugs, and dedupes so two labels can't collide.

This is the single interaction that makes authoring feel like the intake list it
came from:

```
US only, Europe only, worldwide, not sure yet
```

→ four options. Offer it on an empty options list; never force it. Port the
function nearly as-is (drop the value-slugging, since we key by id).

### 2. `scoreInversion: 'earned' | 'remaining'`

`src/types/forms.ts` ~line 405. Display `possible − raw` instead of `raw`, for
diagnostic questionnaires where each scored option is a **pain point** — fewer
selected means a higher displayed score.

Directly useful here: most client-intake questions are risk flags, not merits.

**The critical detail, and the reason it's well designed:** threshold matching
always uses the RAW score. Inversion only changes the displayed number, so
toggling it never silently re-buckets anyone. Preserve that exactly.

### 3. A result page, not a fixed panel

`FormPageBreak.isResultPage` marks which page shows the outcome, and the author
drags whatever else they want onto it. More flexible than a hardcoded verdict
block.

Worth adopting in spirit: the result should be a **composable section**, not a
component nailed to the bottom of the run.

### Deliberately not taken

- **The `QuizDrawer` structure** — see above.
- **`FormField` wholesale** — it carries conditional logic, rows, groups, entity
  mapping and display modes that Decision Lab does not need. Read it for ideas;
  do not import it.
- **`optionScores` as a separate map** — see the divergence note above.

---

## Authoring UX rules

The previous `advanced` editor failed on **sequence and hierarchy**, not
wording: four sections at identical width, nothing claiming the eye, and
instructional sentences where labels belonged. Do not repeat it.

1. **A question is a card, collapsed by default.** Collapsed shows the question
   text, its kind, and its points. Eighteen expanded panels is an unreadable
   wall.
2. **The question text is primary.** Largest thing on the card, always visible.
3. **The type picker is top-right**, beside the label.
4. **Points appear in the footer** next to the "Answer key" reveal — one number,
   never a slider. (No surveyed product uses a slider for scoring.)
5. **Per-option points are progressive disclosure**, behind that one reveal.
   Default with scoring on and nothing customised: first option full points,
   the rest zero. The author overrides only where it matters.
6. **Options are one compact row each** — label, points (when revealed), delete.
   Not a bordered panel per option.
7. **Plain noun labels.** "Question", "Description", "Points", "Options",
   "Required". No instructional sentences, no coaching, **no em dashes in UI
   copy**.
8. **A running total in the header, always.** Every mature tool shows it.
9. **Fast entry beats any bulk-edit feature.** Enter at the end of an option row
   adds the next option. Duplicate-question is the real speed tool (Canvas and
   Lever both ship it, and Google puts it in the footer).

### Sections

`section` exists because real intake lists have headings — "What the site needs
to do", "Logistics", "Business setup". It renders as a divider in the editor and
a real break in the run, and is never scored. It is the cheap way to give an
eighteen-question run some structure.

---

## Run UX

Reuse what already works in `advanced/AdvancedRun.tsx` — the pinned verdict, the
sticky-on-mobile behaviour, write-through-on-tap persistence, and the tokens in
`verdict.css`. The verdict panel is type-agnostic apart from blockers.

Differences:

- **No blockers and no dealbreakers in this type.** They belong to `advanced`.
  Do not port them in; that complexity is what `forms` exists to avoid.
- **Sections break the question list** into labelled groups.
- **`required` questions** must be answered before Finish; everything else stays
  skippable, and skipped stays excluded from both scoring terms.
- **Unscored mode** (`scored: false`) hides the verdict entirely — the run is a
  structured checklist that records answers without judging them.
- **Answer controls should be real tap targets**, one option per line at phone
  width. Opsette's `displayMode: 'button-list' | 'pills'` is a good reference for
  the shapes.

---

## Scoring

```
score    = Σ points over answered, scored questions
maxScore = Σ (max achievable points) over those same questions
percent  = round(score / maxScore × 100)
```

Where "max achievable" follows Opsette's `computeScore.ts`, which gets this
right: **the highest single option** for single-select kinds, **the sum of all
positive options** for checkboxes.

Two rules that must not break, same as `advanced`:

- **Skipped questions are excluded from BOTH terms.** Never scored as zero.
- **Nothing answered reads as "not started", not 0%.**

Note this is stricter than Opsette's version, which returns `percentage: 0` when
`possible` is 0 and counts a field's `possible` even when unanswered. That is
correct for a submitted form (everyone answers everything) and wrong for a run
that is filled in live and out of order.

Write it as `src/types/forms/score.ts`, pure and dependency-free, and add cases
to `scripts/verify-scoring.mjs` the same way — a standalone reimplementation, so
drift between spec and engine fails loudly.

---

## Templates

Ship at least one, built from the real client-intake list (2026-09-18 session
transcript; sections: *What the site needs to do*, *Logistics*, *Business
setup*). Every mature product treats the empty state as a failure.

Templates live in `src/types/forms/templates.ts` and are picked up by
`TemplatePicker` — extend its `type === "advanced"` branch to include them.

---

## Definition of done

- [ ] `src/types/forms/score.ts` + verification cases in `scripts/verify-scoring.mjs`
- [ ] `FormsEditor.tsx` with ONE morphing `QuestionCard`, built in place — no drawer
- [ ] Type picker, inline "Answer key" reveal, header running total
- [ ] `parsePastedOptions` ported
- [ ] `FormsRun.tsx`, including unscored mode and sections
- [ ] At least one template
- [ ] `EditorRoute` / `RunRoute` `forms` branches point at the real screens
- [ ] `ready: true` in `types/registry.tsx`
- [ ] Typechecks (`npx tsc --noEmit`) and works at 375px

## Reference files

| What | Where |
|---|---|
| Scoring engine to mirror | `C:\opsette\opsette-v2\src\components\forms\utils\computeScore.ts` |
| `parsePastedOptions`, `syncOptionScores` | `C:\opsette\opsette-v2\components\forms\builder\FieldConfigurator.tsx` (~line 76+) |
| `scoreInversion`, `scoreThresholds`, `isResultPage` | `C:\opsette\opsette-v2\src\types\forms.ts` (~lines 174, 215, 383–435) |
| Quiz authoring UI (read, do not copy the structure) | `C:\opsette\opsette-v2\components\forms\builder\QuizDrawer.tsx` |
| Where scoring is evaluated at runtime | `C:\opsette\opsette-v2\src\components\forms\FormRenderer.tsx` (~332, ~356, ~1012) |
| Layout reference | Google Forms question card — type picker top-right, "Answer key" footer-left, total points in header |
