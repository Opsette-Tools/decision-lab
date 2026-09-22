# Forms type — build spec

**Status:** BUILT and REVIEWED. Works end to end. Open items (export, a results
page, band-label defaults) are listed under "Still open" at the end of this doc,
along with the review log.
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

Google Forms puts the question-editing surface on the question card itself — no
canvas, no side rail, no modal. From the reference screenshot:

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
2. **No drag-and-drop canvas, no side rail.** Questions are authored in place,
   in a plain vertical list. Reordering is a drag handle on the card, not a
   canvas metaphor.
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

### The scoring drawer — build this TOO, not instead

**Both surfaces, and they do different jobs.** "In-place layout" and "where
scoring is configured" are independent decisions, and conflating them was an
early mistake in this spec.

The card's inline **Answer key** reveal is for adjusting *one* question's points
while you happen to be editing it.

A **scoring drawer** is for everything the card cannot do:

- **Bulk operations across every scored question.** This is the point. Setting
  points one card at a time across eighteen questions is exactly the
  per-question grind this type exists to avoid. Opsette's `QuizDrawer` gets this
  right: *set every option to 1*, *apply to all scored*, reset. Port those.
- **Settings that belong to no single question**, and therefore have no card to
  live on: the scoring on/off toggle, total possible, score display mode
  (`percent` / `number` / `off`), `scoreInversion`, and the thresholds editor.

So: a **Scoring** button in the editor header opens a drawer listing every
scored question with its options and points in one place, bulk actions at the
top, and the global settings and bands below.

**What NOT to take from Opsette's drawer is its structure, not its existence.**
It currently carries the whole per-question scoring UI as the *only* place to
set points, which makes it long and makes the canvas and the drawer feel like
two disconnected apps. Here the card handles the single-question case, so the
drawer can stay focused on bulk and global concerns.

(Ruthnie on that drawer, 2026-09-18: *"this drawer is kind of a mess"* — but also
*"I set the scoring on the drawer rather than per question. Yeah, I guess it
would be worth it."* The bulk capability is the keeper.)

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

### 4. Bulk scoring actions

`QuizDrawer.tsx`. *Set every option to 1*, *apply to all scored*, reset. The
reason a scoring drawer earns its place at all — see "The scoring drawer" above.

### Deliberately not taken

- **`QuizDrawer` as the ONLY place to set points** — the drawer is worth
  building for bulk actions and global settings, but the card keeps its own
  inline Answer key so a single question never requires opening it.
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
8. **A running total in the header, always.** Every mature tool shows it, and
   it is also the entry point to the scoring drawer.
9. **Fast entry on the card; bulk actions in the drawer.** On the card: Enter at
   the end of an option row adds the next option, and Duplicate-question is the
   real speed tool (Canvas and Lever both ship it; Google puts it in the
   footer). Anything that spans *many* questions at once — set all options to 1,
   apply to all scored — belongs in the scoring drawer, not on any card.

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

- [x] `src/types/forms/score.ts` + verification cases in `scripts/verify-scoring.mjs`
- [x] `FormsEditor.tsx` with ONE morphing `QuestionCard`, authored in place — no
      drag-and-drop canvas
- [x] Type picker, inline "Answer key" reveal, header running total
- [x] `ScoringDrawer.tsx` — bulk actions (set all to 1, apply to all scored,
      reset) plus the global settings: scoring toggle, total possible, display
      mode, `scoreInversion`, thresholds editor
- [x] `parsePastedOptions` ported
- [x] `FormsRun.tsx`, including unscored mode and sections
- [x] At least one template
- [x] `EditorRoute` / `RunRoute` `forms` branches point at the real screens
- [x] `ready: true` in `types/registry.tsx`
- [x] Typechecks (`npx tsc --noEmit`) and works at 375px

## Reference files

| What | Where |
|---|---|
| Scoring engine to mirror | `C:\opsette\opsette-v2\src\components\forms\utils\computeScore.ts` |
| `parsePastedOptions`, `syncOptionScores` | `C:\opsette\opsette-v2\components\forms\builder\FieldConfigurator.tsx` (~line 76+) |
| `scoreInversion`, `scoreThresholds`, `isResultPage` | `C:\opsette\opsette-v2\src\types\forms.ts` (~lines 174, 215, 383–435) |
| Quiz authoring UI (read, do not copy the structure) | `C:\opsette\opsette-v2\components\forms\builder\QuizDrawer.tsx` |
| Where scoring is evaluated at runtime | `C:\opsette\opsette-v2\src\components\forms\FormRenderer.tsx` (~332, ~356, ~1012) |
| Layout reference | Google Forms question card — type picker top-right, "Answer key" footer-left, total points in header |

## The two surfaces, in one line each

- **Question card** (in place, morphing, no canvas) — write the question, pick
  its type, set ITS points.
- **Scoring drawer** (opened from the header total) — set points across MANY
  questions at once, and everything global: the toggle, display mode, inversion,
  and the bands.

---

## Build log — 2026-09-18 (built)

**Status: built, typechecking clean, scoring verified. Awaiting Ruthnie's
verification in the running app.**

Everything in Definition of done is shipped. Files added:

| File | What |
|---|---|
| `src/types/forms/score.ts` | The engine. Pure, no deps. |
| `src/types/forms/FormsEditor.tsx` | Editor page: card list, header total, add question/section. |
| `src/types/forms/FormsRun.tsx` | Run screen: sections, required gate, unscored mode. |
| `src/types/forms/templates.ts` | The real client-intake template + default bands. |
| `src/types/forms/components/QuestionCard.tsx` | The ONE morphing card. |
| `src/types/forms/components/ScoringDrawer.tsx` | Bulk actions + global settings. |
| `src/types/forms/components/QuestionRow.tsx` | One question during a run. |
| `src/types/forms/components/FormsVerdict.tsx` | Verdict, no blockers. |
| `src/lib/runSummary.ts` | Type-agnostic run summary for the list pages. |
| 4 CSS files | `forms-editor`, `forms-run`, `question-card`, `scoring-drawer`, `run-row`. |

Wired: `EditorRoute` / `RunRoute` forms branches, `registry.ready: true`,
`TemplatePicker` (now dispatches per type instead of hardcoding `advanced`),
and `scripts/verify-scoring.mjs` (+8 forms cases, 17 checks total, all passing).

### Decisions made during the build that the spec did not settle

**1. `scale` interpolates across its RANGE, not from zero.** The spec said
"`maxPoints` is awarded at `scale.max`, and intermediate points interpolate
linearly," which is ambiguous when `scale.min` is author-settable. Implemented as
`(value - min) / (max - min) × maxPoints`, so a 1..5 scale answered **1 scores
zero** rather than 20%. The alternative (`value / max`) means the bottom of the
scale is never the bottom of the score, which contradicts "labels at each end" —
`minLabel` should mean nothing earned. Verified by case 4 in the script.
Out-of-range values clamp rather than extrapolating.

**2. Turning scoring ON seeds the default points.** Flipping the drawer switch on
an eighteen-question intake would otherwise produce a total of 0 and demand
eighteen hand edits — precisely the grind this type exists to remove. It now
applies "first option full points, the rest zero" **only when nothing is scored
yet**, so it can never overwrite points an author already set and toggled off.

**3. `summarizeRun()` instead of a switch per page.** History and Home both
needed a forms branch. Rather than each page growing its own switch over
`ScorecardType` (which drifts the first time a type is added), both now read one
shared summary. Same reasoning as the registry.

**4. Threshold bands are SHARED with `advanced`, not forked.** `ScoringDrawer`
imports `ThresholdEditor` outright. A score band is a score band, and two copies
of the "highest floor a score clears" rule would drift apart.

**5. `parsePastedOptions` lives in `model.ts`** beside the shape it produces,
with the value-slugging dropped (options key by minted id, so a rename cannot
orphan a score — the divergence the spec called for).

### Mobile decisions, made deliberately rather than by squeeze

- Type picker drops to its own full-width line under 600px; a 168px Select
  beside a question title at 375px crushes both.
- Per-option up/down arrows hide on a phone; delete stays. Three icon buttons
  plus a label plus a points field cannot share a 375px row.
- A 1..10 scale scrolls horizontally rather than shrinking ten targets below
  thumb size.
- Footer halves stack so neither wraps mid-control.

### Not built, and why

- **Grids** (multiple-choice / checkbox grid) — deferred by the spec itself.
- **Result page as a composable section** (`isResultPage`, worth-stealing #3) —
  adopted only in spirit. The run keeps the pinned verdict panel; a genuinely
  composable result section is a bigger change to the run layout than this slice
  called for, and nothing needs it yet.
- **Drag-and-drop reordering** — deliberate. Reordering is the kebab's Move
  up/down, per the spec's "no canvas metaphor."

### Verification state

- `npx tsc --noEmit` — clean (confirmed with a deliberate canary error that the
  new files are actually in the program; this project has ONE tsconfig, so
  `--noEmit` is correct here, unlike the sibling apps that need `tsc -b`).
- `node scripts/verify-scoring.mjs` — 17 checks, all passing.
- Every new module transforms cleanly through Vite (dev server on a scratch port,
  since 8128 was occupied; the server was stopped afterward).
- **Not yet done: Ruthnie's own look at it in the running app, and the full
  production build.** Both are hers to trigger.

### Added mid-session, from Ruthnie's review (2026-09-18)

**1. Paste a whole LIST OF QUESTIONS, not just options.** Her ask: *"if I could
paste all of my questions and it just throws them all down as their separate
questions and then I could configure the question type, rather than having to do
one question at a time."* Exactly the same grind as per-option entry, one level
up — so it gets the same fix.

`parsePastedQuestions` in `model.ts`, surfaced by `components/PasteQuestions.tsx`
and a "Paste a list" button beside Add a section. Three decisions inside it:

- **Splits on NEWLINES ONLY**, unlike the options parser. A question very often
  contains a comma ("Do you have a processor, like Stripe or Square?") and
  splitting on it would shred the question into fragments.
- **Reads answers out of TRAILING parentheses**, so the natural way these get
  written — `Where will you ship to? (US only, Europe only, worldwide)` — comes
  through as a question WITH its options already attached. Only a trailing group
  counts, so a mid-question parenthetical stays part of the text.
- **Strips leading list markers** (`1.`, `2)`, `-`, `*`, `•`), so a list pasted
  out of a doc does not arrive with numbering welded to every question.

Everything lands as `choice` with the standard first-option-wins points, and the
type picker changes it from there.

**2. Placeholders are generic.** Her instruction: don't use the real lead's
questions as placeholder text. The options paste box now reads
`Apples, bananas, kangaroos`, and the question paste box uses an invented fruit
/ sign-up example. The `web-client-intake` TEMPLATE still carries the real
question wording — that is the template's whole value and it names no client —
but nothing typed into an empty field quotes the actual call any more.

---

## Review session — 2026-09-19/20

Ruthnie walked the built type. It works end to end: create a questionnaire,
author questions, score them, run it. What follows is what changed after her
review and what is still open.

### Changed after review

| What | Why |
|---|---|
| `Run it` → `Run` (both editors) | Her call. Library rows and Home already said Run; the editors were the odd ones out. |
| **Back to the scorecard from a run** | There was none. Starting a run to preview left Finish as the only exit. Now an `← Edit scorecard` secondary button in the run header. First attempt was a small arrow inside the eyebrow label — she rejected it as unfindable, correctly. |
| **Button hierarchy written down** | Three header things had three shapes for no reason. The points readout was a hand-rolled `<button>` with its own border, sitting beside a real AntD Button and matching nothing. Now: primary = filled large, secondary = outlined large, tertiary = text. All real AntD Buttons so heights come from the theme. Documented in `advanced-run.css`. |
| **Button padding cut globally** | `Button.paddingInlineLG` 15 → 10, `paddingInline` 7 → 8… set in `theme.tsx`, not per page. NOTE: the first attempt set it to 16, which is ABOVE AntD's 15px default, so it did nothing. Claimed as done before verifying. Check the rendered value, not the diff. |
| **Card padding** 24 → 18px (desktop end of the clamp) | Her word was "big, bubbly." The phone end stays 16px. |
| **Fake drag handle removed** | `.dl-fq-grip` was `pointer-events: none` — a six-dot glyph implying drag that did not exist. She asked what it was, which is the whole problem. |
| Placeholder text genericized | Real intake questions were being used as placeholder text. Template keeps the real wording (that is its value); empty fields now say `Apples, bananas, kangaroos`. |
| **Paste a whole list of QUESTIONS** | See the entry in the previous log. |

### Copy rewritten, and the rule behind it

She flagged the writing hard, twice, and the fault is one specific tic: **a
second sentence that justifies the first.**

| Before | After |
|---|---|
| "Off, it records answers without judging them." | *(deleted — a labelled on/off switch explains itself)* |
| "These override the points already set on each card." | "This replaces the points you set on each question." |
| "Shows the points earned. Switch to remaining when each scored answer is a problem rather than a merit." | "Use remaining when a high score is bad." |
| "Skipped questions don't count against you" | "…against the score" (*you* is the practitioner, not the subject) |
| "Every run keeps its own frozen copy of the scorecard, so later edits never change it" (tooltip) + "Scored against this scorecard as it stood on…" | One line: "Uses the questions as they were on {date}. Editing the scorecard later won't change this run." |
| "Unanswered questions are left out of the score entirely, so the percentage reflects only what you asked. You can reopen this run and keep going later." | "Unanswered questions are left out of the score. You can reopen this run later." |

**The standard going forward:** say what the thing does, once. No explaining a
control that explains itself. No reaching for "problem / merit" when "bad" and
"good" exist. Her words: *"you don't say anything just straight."*

### Corrections to my own process, recorded so they do not repeat

1. **She said padding; I changed height.** `controlHeightLG` 48 → 44 was never
   asked for and has been reverted. Change the thing named, not the thing near it.
2. **"Slimmed globally" was claimed before it was verified.** The value set was
   a no-op. Verify the rendered output, not the diff.
3. **"Kill the cards" was my suggestion, not hers.** She corrected the
   attribution and she was right. Do not rounded-square anything either — her
   note: squaring reads *analog / old school*, and the goal is tighter and more
   professional, not more angular.
4. **The sidebar border is NOT mine.** `git diff` shows `src/layout/` untouched
   all session. `.dl-nav { border-right }` is at `layout.css:19` and predates
   this work — an earlier removal of hers evidently did not save.

### Still open

**Features:**
- **Export.** Nothing exists. A finished run cannot leave the app — no PDF, no
  copy to clipboard, no CSV. For sending a client a filled questionnaire this is
  the biggest gap. *Her read: "we don't have any export features yet, so that's
  something I can build on."* **Recommended next.**
- **Results page.** "Finish run" freezes the run in place and leaves you on the
  same screen. The spec's composable result section (worth-stealing #3) was
  adopted in spirit only.
- **Grids** — deferred by the spec itself, not an oversight.
- **Drag reordering** — kebab Move up/down only today.

**Defaults worth revisiting:**
- The blank questionnaire's bands still read *Ready to build / Needs groundwork /
  Not ready yet*, which is website-build wording applied to every new
  questionnaire regardless of what it scores. She can edit them per scorecard
  (she found the drawer), but the default should be domain-neutral. Candidates
  discussed: Yes / Maybe / No, or Strong / Mixed / Weak. **Her open reaction:
  "I hate that I have to come up with my own labels."** So consider shipping
  more templates rather than expecting authored labels every time.
- `"Below range"` (hardcoded, `score.ts`) is developer phrasing that reaches the
  UI. Rename.

**Outside this type, raised by her for a future session:**
- **The shared Opsette header.** She wants to stop using it here: *"the font
  choice is ugly, the layout is not what I would want, the sidebar underneath
  the header looks ugly, the sidebar collapse button is … not well thought
  out — it literally says Collapse."* Family-wide decision, not a Decision Lab
  one. (For the record: the sidebar font IS Inter, set in `theme.tsx`; the
  complaint is the header's styling, not the typeface.)
- Overall button/UI polish across every page, not just this type.

### The original use case

Worth recording honestly: the web-design lead that motivated Decision Lab was
disqualified by Ruthnie herself before the tool was finished. So the intake
template is now a plausible reconstruction rather than a live case, and she
plans to revisit what this tool is for. That does not invalidate the type — but
do not treat the template as validated by a real run, because it has not had one.

---

## ⚠️ NEXT SESSION: the app shell. Read this first.

**This is Ruthnie's next piece of work, and it is NOT part of the forms type.**
The forms type is done. What follows is the chrome around it, which is in worse
shape than anything inside it.

### 1. The left nav is hand-rolled. It should be `Layout.Sider`.

`src/layout/SideNav.tsx` is a plain `<nav>` with hand-written width, collapse
state, sticky positioning and a `localStorage` key — reimplementing, by hand,
what AntD's `Layout.Sider` already does (`collapsible`, `collapsedWidth`,
`trigger`, `breakpoint`). `AppLayout.tsx` even imports `Layout` and uses
`hasSider`, so the Sider was deliberately skipped.

**This is the same failure as the points button in the editor header:** hand-
rolling a component the library already ships, then hand-maintaining its states.
Ant Design was chosen precisely so this would not happen. Rebuild it as a real
`Sider`.

Her words: *"it's supposed to be ant sider"* … *"everything is built and
designed but some idiot decided to hand roll a stupid navigation."*

**Do not "fix" the nav's styling before rebuilding it as a Sider.** During this
session I removed `border-right` from `.dl-nav` thinking it was the line she
wanted gone. It was not — she meant the **left accent bar on the active item**
(`box-shadow: inset 2px 0 0` on `.dl-nav-item.active`), which is the thing that
makes a sidebar read as a sidebar. `src/layout/layout.css` has been reverted to
its original state and must be treated as untouched.

### 2. The shared Opsette header needs replacing, here at least.

Her assessment: *"I hate our shared header … the font choice is ugly, the layout
is not what I would want, the sidebar underneath the header looks ugly, the
sidebar collapse button is stupid and not well thought out — it literally says
Collapse."*

That collapse control is `.dl-nav-collapse`, a full-width button with a
`border-top` and the literal label "Collapse". A real `Sider` `trigger` replaces
it outright.

Note for whoever picks this up: the sidebar font **is Inter**, set in
`theme.tsx`. The complaint is the header's styling and layout, not the typeface.
This is a family-wide component (`src/components/opsette-header/`), so changing
it here is a decision about the whole tool family, not just Decision Lab.

### 3. Audit for other hand-rolled components.

Two were found and fixed this session (the points readout, and a fake drag
handle that was `pointer-events: none`). The nav is the third and largest. Assume
there are more. **The rule: if AntD ships it, use AntD's.**

She also flagged not knowing what several icons in the UI are — worth a pass on
icon choices for legibility.

### 4. Buttons still are not right.

Changed this session, all in `theme.tsx` so it applies app-wide:
`Button.paddingInlineLG` 15 → **10**, `paddingInline` 7 → **8**, and all three
shadow tokens (`primaryShadow` / `defaultShadow` / `dangerShadow`) → `none`
(the primary-only shadow was making `Run` look taller than the button beside it,
which she spotted).

**She still does not think they look right, and she is the one looking at them.**
Two process failures to avoid repeating:

- I first set `paddingInlineLG: 16`, which is ABOVE AntD's 15px default, so it
  did nothing — and I reported it as done. **Verify the rendered value, not the
  diff.**
- She said *padding*; I also changed `controlHeightLG` 48 → 44, which she never
  asked for. Reverted. **Change the thing named.**

Take another pass with her watching, one value at a time.

### 5. Homepage hero — removed 2026-09-20.

`HomePage.tsx` opened with "Decide the same way / every time." plus a lede
paragraph. She never asked for it: *"What is this homepage … Remove that
bullshit."* Markup and its CSS (`.dl-home-intro`, `.dl-home-title`,
`.dl-home-lede`) are gone; Home now opens straight into the scorecard list. The
rest of the page is untouched.
