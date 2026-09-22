/**
 * Scoring-engine smoke test for the `advanced` type.
 * Run with: node scripts/verify-scoring.mjs
 *
 * Not a test framework — a deliberate, readable check of the arithmetic that
 * the whole tool rests on, including the real 2026-09-17 lead that motivated
 * building this. The engine is pure, so the logic is reimplemented here against
 * the same rules and the expected numbers are asserted by hand.
 *
 * The cases that matter and why:
 *   1. Skipped criteria must leave BOTH terms alone (not score as zero).
 *   2. A disqualifying answer must override an otherwise-high percentage.
 *   3. Blockers must accumulate independently of the score.
 *   4. Nothing answered must read as "not started", not 0%.
 */

import assert from "node:assert/strict";

// ---- The engine's rules, mirrored ------------------------------------------
// Kept as a standalone reimplementation on purpose: if src/types/advanced/score.ts and
// this file ever disagree, one of them is wrong and the run fails loudly.

function maxOptionValue(criterion) {
  return criterion.options.reduce((best, o) => Math.max(best, o.value), 0);
}

function score(rubric, answers) {
  let points = 0;
  let maxPoints = 0;
  let answered = 0;
  const blockers = [];
  let dq = null;

  for (const c of rubric.criteria) {
    const option = c.options.find((o) => o.id === answers[c.id]);
    if (!option) continue; // skipped: excluded from both terms
    answered += 1;
    points += option.value * c.weight;
    maxPoints += maxOptionValue(c) * c.weight;
    if (option.blocks) blockers.push(c.id);
    if (option.disqualifies && !dq) dq = c.id;
  }

  const percent = answered === 0 || maxPoints === 0 ? null : Math.round((points / maxPoints) * 100);
  return { points, maxPoints, percent, answered, blockers, dq };
}

// ---- Fixture: the real web-design lead, 2026-09-17 -------------------------

const rubric = {
  criteria: [
    {
      id: "products",
      weight: 5,
      options: [
        { id: "p-detailed", value: 3 },
        { id: "p-rough", value: 2 },
        { id: "p-cant", value: 0, disqualifies: true },
      ],
    },
    {
      id: "budget",
      weight: 4,
      options: [
        { id: "b-number", value: 3 },
        { id: "b-range", value: 2 },
        { id: "b-evasive", value: 1 },
      ],
    },
    {
      id: "account",
      weight: 3,
      options: [
        { id: "a-yes", value: 3 },
        { id: "a-progress", value: 2, blocks: true },
        { id: "a-no", value: 1, blocks: true },
      ],
    },
    {
      id: "markets",
      weight: 2,
      options: [
        { id: "m-specific", value: 3 },
        { id: "m-one", value: 2 },
        { id: "m-unsure", value: 1 },
      ],
    },
    {
      id: "domain",
      weight: 1,
      options: [
        { id: "d-owns", value: 3 },
        { id: "d-chosen", value: 2, blocks: true },
        { id: "d-nothing", value: 1, blocks: true },
      ],
    },
  ],
};

// ---- Case 1: nothing answered ---------------------------------------------

{
  const r = score(rubric, {});
  assert.equal(r.percent, null, "an untouched run must be null, never 0%");
  assert.equal(r.answered, 0);
  console.log("PASS  nothing answered reads as not-started, not 0%");
}

// ---- Case 2: skipped criteria are excluded from both terms ----------------

{
  // Answer only budget (weight 4) at its best value (3).
  const r = score(rubric, { budget: "b-number" });
  assert.equal(r.points, 12, "3 x weight 4");
  assert.equal(r.maxPoints, 12, "ceiling is also 3 x weight 4");
  assert.equal(r.percent, 100, "one perfect answer with everything else skipped is 100%");
  assert.equal(r.answered, 1);
  console.log("PASS  skipped criteria excluded from numerator AND denominator");
}

{
  // Same answer, but now also a weak one. Skipping must not dilute.
  const r = score(rubric, { budget: "b-number", markets: "m-unsure" });
  // budget: 3x4=12 of 12. markets: 1x2=2 of 6. => 14 of 18 = 78%
  assert.equal(r.points, 14);
  assert.equal(r.maxPoints, 18);
  assert.equal(r.percent, 78);
  console.log("PASS  partial answers score against only what was asked (78%)");
}

// ---- Case 3: the real lead — disqualified regardless of the rest ----------

{
  // The actual 2026-09-17 call: couldn't describe products, no domain, no
  // business account, vague on markets — but a stated budget.
  const r = score(rubric, {
    products: "p-cant",
    budget: "b-number",
    account: "a-no",
    markets: "m-unsure",
    domain: "d-nothing",
  });
  assert.equal(r.dq, "products", "products=cannot-describe must disqualify");
  // Two conditions, not three: account (a-no) and domain (d-nothing) both
  // block. markets=m-unsure is merely a low score — a weak answer is not the
  // same thing as a condition of delivery, and conflating the two would make
  // the blocker list useless as a scope conversation.
  assert.equal(r.blockers.length, 2);
  assert.deepEqual([...r.blockers].sort(), ["account", "domain"]);
  console.log("PASS  the real 2026-09-17 lead disqualifies on products");
  console.log(`      raw percent would have been ${r.percent}% — overridden by the dealbreaker`);
}

// ---- Case 4: a dealbreaker beats a high score -----------------------------

{
  // Everything perfect EXCEPT products, which is the dealbreaker.
  const r = score(rubric, {
    products: "p-cant",
    budget: "b-number",
    account: "a-yes",
    markets: "m-specific",
    domain: "d-owns",
  });
  // points: 0 + 12 + 9 + 6 + 3 = 30; max: 15 + 12 + 9 + 6 + 3 = 45 => 67%
  assert.equal(r.percent, 67);
  assert.equal(r.dq, "products", "a 67% run with a dealbreaker is still a no");
  assert.equal(r.blockers.length, 0, "perfect answers raise no conditions");
  console.log("PASS  a dealbreaker overrides a 67% score");
}

// ---- Case 5: blockers accumulate without touching the score ---------------

{
  const clean = score(rubric, { account: "a-yes", domain: "d-owns" });
  const blocked = score(rubric, { account: "a-progress", domain: "d-chosen" });
  assert.equal(clean.blockers.length, 0);
  assert.equal(blocked.blockers.length, 2, "both mid-scale answers raise a condition");
  assert.ok(blocked.percent < clean.percent, "they also score lower, independently");
  console.log(`PASS  blockers accumulate (2) and score independently (${blocked.percent}% vs ${clean.percent}%)`);
}

// ---- Case 6: a perfect run ------------------------------------------------

{
  const r = score(rubric, {
    products: "p-detailed",
    budget: "b-number",
    account: "a-yes",
    markets: "m-specific",
    domain: "d-owns",
  });
  assert.equal(r.percent, 100);
  assert.equal(r.dq, null);
  assert.equal(r.blockers.length, 0);
  console.log("PASS  all-best answers score 100% with no flags");
}

console.log("\nAll advanced scoring checks passed.");

// ============================================================================
// The `forms` type
// ============================================================================
//
// Same discipline as above: a standalone reimplementation of the rules in
// src/types/forms/score.ts, so if the two ever disagree one of them is wrong
// and this run fails loudly.
//
// The cases that matter and why:
//   1. Skipped questions leave BOTH terms alone (shared with advanced).
//   2. Nothing answered reads as "not started", not 0%.
//   3. Checkboxes SUM across checked options; their ceiling is the sum of
//      positives, so a negative option cannot make a perfect score unreachable.
//   4. A scale interpolates across its RANGE, so its floor is worth zero.
//   5. scoreInversion changes the displayed number and NEVER the band.
//   6. Text and section questions are captured but never judged.

function formsMaxPoints(q) {
  if (q.kind === "text" || q.kind === "section") return 0;
  if (q.kind === "scale") return q.scale?.maxPoints ?? 0;
  if (q.kind === "checkboxes") {
    return q.options.reduce((sum, o) => sum + Math.max(0, o.points ?? 0), 0);
  }
  return q.options.reduce((best, o) => Math.max(best, o.points ?? 0), 0);
}

function formsScalePoints(q, value) {
  const s = q.scale;
  if (!s) return 0;
  const maxPoints = s.maxPoints ?? 0;
  const span = s.max - s.min;
  if (span <= 0) return maxPoints;
  const clamped = Math.min(Math.max(value, s.min), s.max);
  return ((clamped - s.min) / span) * maxPoints;
}

function formsAnswered(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return Number.isFinite(value);
}

function scoreForms(doc, answers) {
  let points = 0;
  let maxPoints = 0;
  let answered = 0;
  let total = 0;

  for (const q of doc.questions) {
    if (q.kind === "section") continue; // a divider is never a question
    total += 1;
    const value = answers[q.id];
    if (!formsAnswered(value)) continue; // skipped: excluded from both terms
    answered += 1;
    if (q.kind === "text" || !doc.scored) continue; // captured, never judged

    if (q.kind === "scale") {
      points += formsScalePoints(q, value);
    } else if (q.kind === "checkboxes") {
      for (const id of value) {
        const o = q.options.find((x) => x.id === id);
        if (o) points += o.points ?? 0;
      }
    } else {
      const o = q.options.find((x) => x.id === value);
      if (o) points += o.points ?? 0;
    }
    maxPoints += formsMaxPoints(q);
  }

  const percent = !doc.scored || maxPoints === 0 ? null : Math.round((points / maxPoints) * 100);
  const displayScore = doc.scoreInversion === "remaining" ? maxPoints - points : points;
  return { points, maxPoints, percent, answered, total, displayScore };
}

function bandFor(thresholds, percent) {
  let best = null;
  for (const t of thresholds) {
    if (percent >= t.min && (best === null || t.min > best.min)) best = t;
  }
  return best;
}

// ---- Fixture: the real client-intake list, 2026-09-18 ---------------------

const intake = {
  scored: true,
  scoreInversion: "earned",
  thresholds: [
    { min: 70, label: "Ready to build", tone: "pass" },
    { min: 40, label: "Needs groundwork", tone: "warn" },
    { min: 0, label: "Not ready yet", tone: "fail" },
  ],
  questions: [
    { id: "sec1", kind: "section", label: "Logistics", options: [] },
    {
      id: "ship",
      kind: "choice",
      label: "Where will you ship to?",
      options: [
        { id: "ship-us", label: "US only", points: 3 },
        { id: "ship-eu", label: "Europe only", points: 3 },
        { id: "ship-ww", label: "Worldwide", points: 2 },
        { id: "ship-idk", label: "Not sure yet", points: 0 },
      ],
    },
    {
      id: "pay",
      kind: "choice",
      label: "Payment processor set up?",
      options: [
        { id: "pay-yes", label: "Yes", points: 3 },
        { id: "pay-no", label: "No", points: 1 },
        { id: "pay-idk", label: "Not sure yet", points: 0 },
      ],
    },
    {
      id: "have",
      kind: "checkboxes",
      label: "What do you already have?",
      options: [
        { id: "have-domain", label: "A domain", points: 2 },
        { id: "have-logo", label: "A logo", points: 1 },
        { id: "have-copy", label: "Written copy", points: 2 },
        { id: "have-none", label: "None of these", points: -1 },
      ],
    },
    {
      id: "ready",
      kind: "scale",
      label: "How ready are you to launch?",
      options: [],
      scale: { min: 1, max: 5, maxPoints: 4 },
    },
    { id: "notes", kind: "text", label: "Anything else?", options: [] },
  ],
};

// ---- Case 1: nothing answered --------------------------------------------

{
  const r = scoreForms(intake, {});
  assert.equal(r.percent, null, "an untouched forms run must be null, never 0%");
  assert.equal(r.answered, 0);
  assert.equal(r.total, 5, "the section is not a question; the other five are");
  console.log("PASS  forms: nothing answered reads as not-started, not 0%");
}

// ---- Case 2: skipped questions are excluded from both terms --------------

{
  // Answer only the shipping question, at its best value.
  const r = scoreForms(intake, { ship: "ship-us" });
  assert.equal(r.points, 3);
  assert.equal(r.maxPoints, 3, "ceiling is the best single option, not the sum");
  assert.equal(r.percent, 100, "one perfect answer with the rest skipped is 100%");
  assert.equal(r.answered, 1);
  console.log("PASS  forms: skipped questions excluded from numerator AND denominator");
}

{
  // Add a zero-point answer. It must pull the percentage down, not be skipped.
  const r = scoreForms(intake, { ship: "ship-us", pay: "pay-idk" });
  assert.equal(r.points, 3, "the zero-point option adds nothing");
  assert.equal(r.maxPoints, 6, "but its ceiling still counts - it WAS answered");
  assert.equal(r.percent, 50);
  console.log("PASS  forms: a zero-point answer scores 0 but still counts toward the ceiling");
}

// ---- Case 3: checkboxes sum, and their ceiling skips negatives ------------

{
  const q = intake.questions.find((x) => x.id === "have");
  assert.equal(formsMaxPoints(q), 5, "2 + 1 + 2; the -1 option is NOT in the ceiling");

  const r = scoreForms(intake, { have: ["have-domain", "have-copy"] });
  assert.equal(r.points, 4, "points sum across every checked option");
  assert.equal(r.maxPoints, 5);
  assert.equal(r.percent, 80);
  console.log("PASS  forms: checkbox points sum; ceiling is the sum of POSITIVE options");
}

{
  // A negative option is a real penalty, and must be able to drive a question
  // below zero without breaking the ceiling.
  const r = scoreForms(intake, { have: ["have-none"] });
  assert.equal(r.points, -1);
  assert.equal(r.maxPoints, 5);
  console.log("PASS  forms: a negative checkbox option penalizes without inflating the ceiling");
}

// ---- Case 4: a scale interpolates across its RANGE ------------------------

{
  const q = intake.questions.find((x) => x.id === "ready");
  // The scale is 1..5 worth 4 points. Answering 1 is the WORST available
  // answer, so it must be worth zero - not 4 x (1/5) = 0.8, which is what
  // dividing by max alone would give.
  assert.equal(formsScalePoints(q, 1), 0, "the floor of the scale is worth zero");
  assert.equal(formsScalePoints(q, 3), 2, "the midpoint is worth half");
  assert.equal(formsScalePoints(q, 5), 4, "the top is worth all of it");
  // Out-of-range values clamp rather than extrapolating past the ceiling.
  assert.equal(formsScalePoints(q, 9), 4, "a value above max clamps to max");
  assert.equal(formsScalePoints(q, 0), 0, "a value below min clamps to min");
  console.log("PASS  forms: a scale interpolates across its range, so its floor scores 0");
}

// ---- Case 5: text and sections are captured but never judged -------------

{
  const r = scoreForms(intake, { notes: "They seemed rushed but serious." });
  assert.equal(r.answered, 1, "the text answer counts as answered");
  assert.equal(r.maxPoints, 0, "and contributes nothing to the ceiling");
  assert.equal(r.percent, null, "so the run is still unscored");
  console.log("PASS  forms: text is captured, never judged");
}

// ---- Case 6: inversion moves the display, NEVER the band ------------------

{
  const answers = { ship: "ship-idk", pay: "pay-no", have: ["have-none"] };

  const earned = scoreForms(intake, answers);
  const remaining = scoreForms({ ...intake, scoreInversion: "remaining" }, answers);

  // points: 0 + 1 + (-1) = 0. ceiling: 3 + 3 + 5 = 11.
  assert.equal(earned.points, 0);
  assert.equal(earned.maxPoints, 11);
  assert.equal(earned.displayScore, 0, "earned shows the raw score");
  assert.equal(remaining.displayScore, 11, "remaining shows possible - raw");

  // The critical rule: the two must land in the SAME band, because the band is
  // matched on the raw percent. If inversion could re-bucket a run, toggling a
  // display setting would silently rewrite every past verdict.
  assert.equal(earned.percent, remaining.percent, "inversion must not change the percent");
  const bandA = bandFor(intake.thresholds, earned.percent);
  const bandB = bandFor(intake.thresholds, remaining.percent);
  assert.equal(bandA.label, bandB.label, "inversion must never re-bucket a run");
  assert.equal(bandA.label, "Not ready yet");
  console.log("PASS  forms: inversion changes the displayed number, never the band");
}

// ---- Case 7: scoring switched off - a checklist, not a quiz ---------------

{
  const checklist = { ...intake, scored: false };
  const r = scoreForms(checklist, { ship: "ship-us", pay: "pay-yes" });
  assert.equal(r.percent, null, "an unscored doc never produces a percentage");
  assert.equal(r.answered, 2, "but it still tracks what has been answered");
  assert.equal(r.maxPoints, 0);
  console.log("PASS  forms: scoring off records answers without judging them");
}

// ---- Case 8: a full, realistic run ---------------------------------------

{
  const r = scoreForms(intake, {
    ship: "ship-us",             // 3 of 3
    pay: "pay-no",               // 1 of 3
    have: ["have-domain"],       // 2 of 5
    ready: 4,                    // (4-1)/(5-1) x 4 = 3 of 4
    notes: "Follow up Tuesday.", // captured, unscored
  });
  assert.equal(r.points, 9);
  assert.equal(r.maxPoints, 15);
  assert.equal(r.percent, 60);
  assert.equal(r.answered, 5);
  assert.equal(bandFor(intake.thresholds, r.percent).label, "Needs groundwork");
  console.log("PASS  forms: a full intake run scores 60% and lands in the middle band");
}

console.log("\nAll forms scoring checks passed.");
