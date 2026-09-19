# Decision Lab — a scored decision framework

> ## ⚠️ Superseded in part — read `SCORECARD_TYPES.md` first
>
> **2026-09-18, after the first build session.** This doc describes ONE format,
> and treats it as the whole product. That was wrong.
>
> **Decision Lab is a lab: it holds several kinds of scorecard**, the way
> SmartFlow holds swimlane / flowchart / org chart. The format described below
> is now one type among several — `advanced`, the weighted rubric. It is built,
> it works, and it over-serves the common case.
>
> - **`SCORECARD_TYPES.md`** — the type registry, the spine, and the research
>   behind the change. Start there.
> - **`FORMS_TYPE_SPEC.md`** — the Google Forms-shaped `forms` type, which is
>   what most scorecards should be. Not built yet.
>
> §1–§8 below remain accurate **as the design of the `advanced` type**. §5's
> reference guidance and §6's starter list are both superseded — see §11 and
> §12. §10 (absorbing Decision Wheel) is unaffected and still open.

**Status:** planning. Not built. New standalone tool, not part of Process Checklist.
**Written:** 2026-09-18
**Owner:** Ruthnie
**Name:** Decision Lab (confirmed 2026-09-18) · slug `decision-lab`

> **This doc lives in `process-checklist/docs/` only because that's where the
> conversation happened.** Move it into the new tool's repo once the folder
> exists.

---

## 1. What it is, and what it is NOT

**It is:** a tool for building a **weighted rubric** once, then running it
repeatedly against real situations, with every run saved and comparable.

The user does the thinking *in advance* — defines what matters, how much each
factor weighs, what's an automatic no. Then when the situation comes up, they run
it and get a consistent answer instead of re-deriving it under pressure.

**The product is: your judgment, made repeatable.**

**It is NOT a lead qualifier.** Lead qualification is one instance. Building only
that instance isn't worth the time. The engine must never know what a "domain" or
a "client" is — it sees criteria, weights, and scored options. Domain content is
just data.

**It is NOT a decision tree.** Nothing branches in v1. Every criterion is
answered on a graded scale. It's a **temperature reading**, not a flowchart.

**It is NOT a form.** A form is built around someone else submitting to you. Here
the operator holds the instrument, fills it in live during a conversation, and the
scoring logic is private. Using a form means being your own submitter and hiding
your own scoring from a system designed to show results to the submitter.

**It is NOT a checklist.** A checklist answers "what's left to do." This answers
"should I do this at all." The *authoring* UI is similar; the runtime is not.

### Use cases (same engine, different rubric content)

- Take this client? — budget fit, scope clarity, red flags, payment terms
- Buy this equipment / vehicle / property? — condition, price, timing
- Vendor or subcontractor selection
- Hire this candidate?
- Go/no-go on an RFP or solicitation
- Is this deal still worth pursuing? — rerun at each stage and compare
- Should we launch this / kill this?

### Why it's standalone

The **criteria set is the reusable asset**, and nothing else in the family holds
one. A checklist holds tasks. A form collects submissions. Neither stores "here's
how I decide this kind of thing, and here's what I decided the last nine times."

The same gap exists for a contractor bidding jobs and a consultant taking
clients. That's what makes it agnostic and sellable.

---

## 2. The engine

Established pattern: **weighted rubric scoring**. Same math as ATS candidate
scorecards, grant review rubrics, and procurement weighted-scoring matrices.
Nothing packaged for a solo operator to build their own in ten minutes — they're
buried in enterprise software or living in a spreadsheet.

**No dependency, no library, no AI.** It's a weighted sum with a short-circuit.

### Four parts

**1. Criterion** — a named question. "Already has a domain."

**2. An ordered answer scale** — never yes/no, always graded, because reality is
graded. Each option carries a numeric value.

> Owns it (3) · Chosen but not purchased (2) · Hasn't thought about it (1)

That middle option is the whole point: not a yes, not a no. It won't stop the
project, but it can't be ignored either.

**3. A weight per criterion.** "Has a domain" might be weight 1 — annoying, not
fatal. "Can describe their products" might be weight 5.

**4. Two independent flags per answer option:**

- **`disqualifies`** — this answer ends it, whatever else is true. Short-circuits
  the whole run.
- **`blocks`** — doesn't kill the deal, but must be resolved before delivery.

**The blocker concept is as valuable as the score.** "I can't hand this over in
Wix until you give me a domain" is a *condition of delivery*, not a scoring
concern. A rubric that accumulates those automatically hands you the scope
conversation, pre-written. That's the list that otherwise gets written on a napkin
and lost.

### Scoring

```
score    = Σ (answerValue × criterionWeight)  for every answered criterion
maxScore = Σ (maxOptionValue × criterionWeight) for every answered criterion
percent  = round(score / maxScore × 100)
```

- **Skipped criteria are excluded from both terms** — calls don't go in order, and
  an unanswered question must not read as a zero.
- **Percentage, not raw points.** Legible ("74%"), comparable across rubrics, and
  handles skips cleanly.
- **Any `disqualifies` answer overrides everything.** Verdict becomes
  `disqualified` regardless of percent, and the UI names which answer caused it.
- Thresholds are set per rubric and produce the verdict band.

### Worked example — web design client (real case, 2026-09-17)

| Criterion | Weight | Options (value) |
|---|---|---|
| Has a domain | 1 | Owns it (3) · Chosen, not bought (2, **blocks**) · Nothing yet (1, **blocks**) |
| Can describe products | 5 | Detailed + photos (3) · Rough idea (2) · **Can't (0, disqualifies)** |
| Business account set up | 3 | Yes (3) · In progress (2, **blocks**) · No (1, **blocks**) |
| Knows where they'll sell | 2 | Specific markets (3) · One country (2) · "Not sure" (1) |
| Budget clarity | 4 | Number stated (3) · Range (2) · Evasive (1) |

The real lead: no domain, no business account, couldn't show products, wanted
e-commerce. **Products = "Can't" → disqualified immediately**, regardless of the
rest. That verdict was available in real time instead of being reasoned out
afterward.

---

## 3. Schema sketch

```ts
interface Rubric {
  data_id: string;
  name: string;              // "Web Design Client Fit"
  description?: string;
  criteria: Criterion[];
  thresholds: Threshold[];
  createdAt: number;
  updatedAt: number;
}

interface Criterion {
  data_id: string;
  label: string;             // "Can they describe their products?"
  hint?: string;             // operator-only note: what to listen for
  weight: number;            // 1..5
  options: AnswerOption[];   // ordered, best → worst
  sortOrder: number;
}

interface AnswerOption {
  data_id: string;
  label: string;             // "Detailed, with photos"
  value: number;
  disqualifies?: boolean;
  blocks?: boolean;
  blockerNote?: string;      // "Need domain before Wix handoff"
}

interface Threshold {
  min: number;               // percent
  label: string;             // "Good fit"
  tone: 'pass' | 'warn' | 'fail';
}

/** One execution of a rubric against a real situation. */
interface Run {
  data_id: string;
  rubricId: string;
  rubricSnapshot: Rubric;    // see note below — critical
  subject: string;           // "Acme Co — website build"
  notes?: string;
  answers: Record<string, string>;  // criterionId -> optionId
  startedAt: number;
  completedAt?: number;
}
```

### `rubricSnapshot` is not optional

A run must embed a **frozen copy of the rubric it was scored against**. Editing a
rubric later must never retroactively change what a past run scored — that would
silently rewrite history and destroy the comparability that is the whole point.
Same discipline as an invoice storing its line items rather than pointing at a
live price list.

---

## 4. UI

Two distinct modes. The authoring mode resembles a checklist editor structurally;
the run mode is its own thing and is where the product lives or dies.

### 4a. Build a rubric

Ordered list of criteria, drag to reorder, each expanding to set weight and edit
its answer options. Options are themselves an ordered list, best → worst, each
with value + flags.

Needs: duplicate a criterion, duplicate a whole rubric, and **starter rubrics by
domain** (see §6).

### 4b. Run a rubric — the part that has to be right

**Design assumption: the operator is on a live call and cannot look away.**

- One criterion per row; answer options as a **segmented control, one tap**. No
  dropdowns — a dropdown costs two interactions and hides the choices.
- Operator-only `hint` visible under the criterion — what to listen for.
- **Live verdict pinned in view.** Not just a number: a state.
  *On track* / *At risk* / *Disqualified*.
- **On disqualification the whole surface changes state** and names the answer
  that caused it. No hunting.
- **Blockers accumulate in a visible running list** as answers are given. At the
  end that list *is* the scope conversation.
- **Criteria are skippable** and skipping is normal — calls don't go in order.
  Skipped ≠ zero.
- Free-text `notes` on the run, always available.

### 4c. After a run

Saved, scored, comparable. List of past runs per rubric. Export (PDF) so a run can
be attached to a client file.

---

## 5. Design and build standards — NOT the Process Checklist look

**Process Checklist's UI is the anti-reference.** Mimic as little as possible.

### Reference apps in the family

- **File Builder** (`c:\Opsette Tools\file-builder`) — the strongest. Study
  `src/styles/tokens.css` and `src/components/shell/AppShell.tsx`. It feels solid
  because it has an actual **design token system** (fluid `clamp()` type scale,
  spacing ramp, radius, card padding) that components read from, instead of
  inline magic numbers scattered per file. It also has a real shell with a rail
  that owns the full left edge. **Copy this discipline — it is the single biggest
  reason it reads as intentional.** Known gaps: no collapsible sidebar, a little
  stiff.
- **Brand Board** — acceptable, not offensive.
- **SmartFlow Schema Designer only** (`smart-flow/src/components/smartflow/schema/`)
  — feels fluid. The rest of SmartFlow is not a reference.

### Hard rules for this build

1. **Router from day one.** Most family apps skipped it and it shows. Real routes:
   rubric list, rubric editor, run, run history.
2. **Collapsible sidebar** from the start.
3. **Design tokens before components.** Port File Builder's `tokens.css` approach
   first. No inline `fontSize: 14` anywhere.
4. **No on-page button rows** where it can be helped. The Process Checklist action
   bar (Save · Save as Template · Copy · Export PDF · Categories · Delete strung
   across the page) is exactly what not to do.
5. **Ant Design**, but the implementations that look solid, not flimsy. AntD
   defaults are not a design.
6. **Mobile-first and genuinely designed** for a phone — a run on a phone during a
   call is a primary use case, not an afterthought.
7. Shared family components reused as-is: `opsette-header`, `opsette-share`,
   dark/light toggle, About/Privacy modals, footer.

---

## 6. Starter rubrics (the blank-page problem)

A blank rubric builder is intimidating. Ship **static starter rubrics by domain**,
the way Script Builder ships industry starters — editable skeletons, not finished
products.

Candidates: client fit (services), client fit (web/design), subcontractor
selection, equipment purchase, RFP go/no-go, candidate screen.

### On AI

AI would genuinely help at exactly one point: **generating a first-draft rubric
from a plain description** ("I'm a web designer deciding whether to take a
client"). That solves the blank page.

**The running of a rubric must never be AI.** The entire value is that it's
deterministic — same answers, same verdict, every time, with visible reasoning. An
AI that says "this seems risky" is what the operator already has in their head,
and that's exactly what failed on 2026-09-17.

Static starters give the same blank-page fix with no AI, and keep the family's
static/offline constraint intact. **v1: static starters only.**

---

## 7. Persistence and the iframe bridge

Standalone-first with localStorage, plus the Opsette parent bridge — same protocol
as Process Checklist.

**Copy `process-checklist/src/lib/bridge.ts` as the reference implementation.** It
is clean, proven in production, and already handles the subtle parts:
request-id-matched acks (so parallel saves don't cross-resolve), handshake
timeout, trusted-origin checks, and wiping local data once the bridge becomes
authoritative.

Change only the payload shape. The parent stores an opaque JSONB blob and never
introspects it, so `Rubric` and `Run` ride along with **no parent-side schema
work**.

Two storage collections rather than one: rubrics (the reusable assets) and runs
(the history). Presets can hold anything org-wide.

---

## 8. Scope for v1

**In:**
- Build, edit, duplicate rubrics
- Weighted scoring with percentage normalization
- Disqualifiers and blockers
- Run mode with live verdict and accumulating blocker list
- Saved runs, comparable, per rubric
- Static starter rubrics
- PDF export of a completed run
- localStorage + iframe bridge

**Out (v2+):**
- **Conditional / branching criteria** — "if no domain, ask these three
  follow-ups." Powerful, roughly doubles the run-mode UI. Ship flat first; flat
  with disqualifiers alone would have caught the 2026-09-17 lead.
- Sharing a run with the subject (weights stay private in v1 — private by default
  is the premise)
- Cross-run analytics ("you disqualify 40% on budget clarity")
- AI-drafted rubrics

---

## 9. Open questions

1. Should a criterion support **N/A** distinctly from skipped?
2. Should weights be a free number or a constrained scale (1–5)? Constrained is
   easier to reason about and keeps percentages sane.
3. Can a single run be scored against **two rubrics** at once? Probably not v1.

---

## 10. Absorbing Decision Wheel

**Decided 2026-09-18.** The standalone `decision-wheel` tool gets folded into
Decision Lab as a feature, and its repo retired.

**Why it's the right call:** two decision tools in the family — one serious, one
trivial — is a weaker story than one tool that covers both weights of decision.
Decision Lab handles the deliberate decision; the wheel handles the one that
doesn't deserve deliberation. The name earns both, which "Go/No-Go" would not
have.

**What to lift:** `decision-wheel/src/components/Wheel.tsx` (184 lines),
`OptionsPanel.tsx` (235), `ResultModal.tsx` (60). Self-contained, no
wheel-specific dependencies — a clean port rather than a rewrite. Re-skin to
Decision Lab's token system rather than carrying its styling over.

**Where it sits:** its own route (router is a day-one requirement, §5), as a
sibling to rubrics rather than buried inside one. A quick spin is a different
intent from running a rubric and shouldn't be nested under one.

**Worth considering, not v1:** letting a wheel be seeded from a rubric's tied
outcomes — when two options score within a point of each other, spin. That ties
the two halves together instead of leaving the wheel as a bolted-on toy. Only do
this if it feels natural once both exist.

**Retire the standalone repo only after** the feature is live in Decision Lab and
the marketplace listing is repointed.

---

## 11. Build log — Session 1 (2026-09-18)

**Status: foundation complete and running.** Dev server on **port 8128**
(`http://localhost:8128/`). Everything below is built, typechecking clean, and
verified rendering. Not yet committed — awaiting Ruthnie's verification.

### Correction to §5's reference guidance

The doc names **File Builder** as the strongest reference. That is right for
*token discipline* but wrong architecturally: File Builder has **no router and
no collapsible sidebar**, the two non-negotiables in §5. **SmartFlow is the
better architectural reference** and the doc dismisses it too broadly (§5 only
credits its Schema Designer).

What was taken from SmartFlow, all of it already proven in production:
- `BrowserRouter` with `basename` derived from `import.meta.env.BASE_URL`
- **GitHub Pages SPA deep-link fix** — `public/404.html` + `decodeSpaRedirect()`
  in `main.tsx`. Not optional: without it, a refresh on `/decision-lab/run/:id`
  404s in production. This was not in the plan and would have bitten us.
- Collapsible sidebar with a mobile `Drawer`
- The IndexedDB repo + bridge-sync pattern (`flowsRepo` → `rubricsRepo`/`runsRepo`)

File Builder's contribution is the `tokens.css` approach, as §5 intended.

### Decisions taken (and why)

**Storage is IndexedDB, not localStorage** — §7 said localStorage. Overridden:
every run embeds a full `rubricSnapshot`, so the data grows in exactly the shape
that silently blows the localStorage quota (this has bitten the family before —
see Brand Board). The bridge protocol and payload contract are unchanged; only
the local substrate differs, and the parent never sees the difference.

**§9.2 — weights are constrained 1–5, treated as closed.** Unbounded weights let
one criterion silently swamp the rest and make percentages non-comparable across
rubrics — which breaks the cross-run comparison that is the product. Standard
weighted-scoring practice (procurement matrices, ATS scorecards) constrains the
scale for this exact reason. `WEIGHT_MIN`/`WEIGHT_MAX` in `db/types.ts`.

**§9.1 — N/A vs. skipped: skipped only in v1.** They are mathematically
identical under the §2 formula (both excluded from numerator and denominator), so
a second concept would add UI with no scoring difference.

**Option values are bounded 0–5** (`VALUE_MIN`/`VALUE_MAX`) so one option cannot
out-vote its own weight.

**Segmented was rejected for the run-mode answer picker.** It is the right shape
but the wrong control: no unselected state to return to (so clearing an answer
has nowhere to live), it truncates long option labels instead of wrapping, and it
cannot carry a per-option dealbreaker marker. Hand-rolled buttons
(`components/run/CriterionRow.tsx`) keep the one-tap promise and support all
three. AntD's `Segmented` token is still raised in `theme.tsx` for the places it
IS used (threshold tone, history filter).

### What shipped

| Area | Files |
|---|---|
| Scaffold | `package.json`, `vite.config.ts` (base `/decision-lab/`, port 8128), `tsconfig.json`, `index.html` (head spec), `public/manifest.webmanifest`, `public/404.html`, `.github/workflows/deploy.yml`, `.gitignore` |
| Tokens | `src/styles/tokens.css` — fluid type scale, spacing ramp, **verdict-state colors** (pass/warn/fail/**disqualified**/blocker) in light + dark, sidebar widths, surfaces |
| Engine | `src/lib/score.ts` — pure, dependency-free, no AI |
| Data | `src/db/types.ts`, `db.ts`, `rubricsRepo.ts`, `runsRepo.ts` — two IDB stores, UUID keys, bridge-ready |
| Bridge | `src/components/opsette-bridge/` (copied), `src/lib/bridgeInstance.ts` |
| Chrome | `src/App.tsx`, `src/layout/AppLayout.tsx`, `SideNav.tsx`, `layout.css` |
| Scorecards | `src/pages/RubricsPage.tsx`, `RubricEditorPage.tsx`, `components/editor/CriterionEditor.tsx`, `ThresholdEditor.tsx` |
| Run mode | `src/pages/RunPage.tsx`, `components/run/CriterionRow.tsx`, `components/verdict/VerdictPanel.tsx` |
| History | `src/pages/HistoryPage.tsx` — grouped **by scorecard**, since two runs of different scorecards scoring 74% are not comparable |
| Home | `src/pages/HomePage.tsx` |
| Starters | `src/lib/starters.ts` — 6 static starters (§6), including the real 2026-09-17 web-design case |
| Icons | Added `decision-lab` (Phosphor `scales`) to `_shared/brand-icons/generate.mjs`; favicon/192/512/og-image generated and in `public/` |

**Routes:** `/` · `/scorecards` · `/scorecards/:id` · `/run/:id` · `/history`

### Scoring verified against the real case

`scripts/verify-scoring.mjs` (run: `node scripts/verify-scoring.mjs`) — a
standalone reimplementation of the rules, so if it and `score.ts` ever disagree
one of them is wrong and it fails loudly. All pass:

- nothing answered reads as **not-started, not 0%**
- skipped criteria excluded from **both** terms
- partial answers score against only what was asked (78%)
- **the real 2026-09-17 lead disqualifies on products** — raw score would have
  been 40%, overridden by the dealbreaker
- a dealbreaker overrides a 67% score
- blockers accumulate (2) independently of the score
- all-best answers = 100%, no flags

### Left for next session

1. **Decision Wheel absorption (§10)** — not started. Port `Wheel.tsx`,
   `OptionsPanel.tsx`, `ResultModal.tsx` from `decision-wheel/`, re-skin to the
   token system, give it a `/wheel` route. Retire the standalone repo only after
   it is live here and the marketplace listing is repointed.
2. **PDF export of a completed run (§8)** — `jspdf` is already a dependency; no
   code written yet.
3. **Drag-to-reorder criteria** — `@dnd-kit` is installed but unused. Ordering
   currently works via move up/down in the criterion kebab, which is functional
   and fully keyboard-accessible; drag is the upgrade.
4. **Duplicate a whole rubric from the editor** — `rubricsRepo.duplicate` exists
   and is wired into the library list, but not into the editor page.
5. **GitHub repo + Actions + apex landing-page card** — nothing pushed yet.
6. **Mobile pass on a real phone.** Designed mobile-first throughout (answers go
   full-width one-per-line under 600px; the verdict becomes a sticky top bar
   under 992px; threshold rows stack), but not yet held in a hand.

---

## 12. Build log — Session 2 (2026-09-18): the type refactor

**No features were built this session. It was a structural refactor**, done
after the session-1 build was reviewed and found to be the wrong shape.

### What was wrong

The session-1 build implemented this doc faithfully: one weighted-rubric format,
applied to every scorecard. On review that turned out to be two mistakes at
once.

**1. Decision Lab is a lab, and the build was a single format.** The intent —
not captured anywhere in this doc — was always a tool that holds *multiple*
scorecard kinds, the way SmartFlow holds multiple diagram kinds. Building one
rigid format and treating it as the product missed the premise.

**2. The one format it did build over-serves the common case.** Every question
requires a hand-written answer set, five fields deep. For an eighteen-question
client intake that collapses. The authoring UI was also genuinely bad — no
visual hierarchy, instructional sentences where labels belonged, a slider for
weight (no surveyed product uses one), and invented rules ("answers, best to
worst") that were implementation detail leaking into the interface.

Cross-industry research (six categories, ~25 products — findings recorded in
`SCORECARD_TYPES.md`) confirmed it: **no mature tool asks for a custom answer set
per question.** Rating scales are shared and inherited; question *types* are what
vary.

### What changed

- **`Scorecard` replaces `Rubric`**, with a `type` discriminator and a
  `content` payload that is a real discriminated union. `Run.answers` is a
  tagged union too, so each type owns its own answer shape.
- **`src/types/<id>/`** — each type owns its model, scoring, editor, run screen
  and components. `advanced` moved there wholesale.
- **`types/registry.tsx`** — one entry per type. The library, chooser, home and
  history pages all read through it, so adding a type touches no page.
- **`EditorRoute` / `RunRoute`** dispatch `/scorecards/:id` and `/run/:id` on
  type. The URL names the scorecard, never the format.
- **`TypeChooser`** — "new scorecard" is now a question before it is an action.
  Leads into `TemplatePicker` so a new scorecard never starts blank by default.
- **DB v2** — `rubrics` → `scorecards`. The upgrade *drops* v1 stores rather
  than migrating: nothing shipped, no production data existed, and a migration
  for data that never existed is a liability.
- **Templates cut from six to one.** "Web design client fit" survives as the
  `advanced` template — the real 2026-09-17 case, the one where dealbreakers and
  blockers genuinely earn their complexity. The other five were the same heavy
  format restated, and made the library look busy while teaching nothing new.
- **`forms` type defined** — model and registry slot only, so a later session
  builds into a prepared slot instead of fighting the structure.

### Verified

- `npx tsc --noEmit` clean
- `node scripts/verify-scoring.mjs` — all seven cases still pass, including the
  real 2026-09-17 lead disqualifying on products (raw score 40%)
- Every module transforms and serves (dev server, port 8128)

### Superseding §6

§6 proposed six starter rubrics. **One remains**, by design. Lighter question
sets belong to the `forms` type, not to six variations of the heavy one.

§6's position on AI is unchanged and still correct: static starters only, and
the *running* of a scorecard must never be AI.

### Left for next session

1. **Build the `forms` type** — full spec in `FORMS_TYPE_SPEC.md`. Compare
   against Opsette's own form builder before starting; mirror it rather than
   inventing a second pattern for the same job.
2. **Fix the `advanced` editor's UX** — it still has the session-1 problems
   (slider, hierarchy, labels). Lower priority than `forms`, since `forms`
   is what most scorecards should use.
3. **GitHub Pages + Actions** — the workflow file exists; Pages is not enabled.
4. **Decision Wheel absorption (§10)** — untouched, still open.
5. **PDF export** — `jspdf` installed, unused.
6. **Mobile pass on a real phone.**
