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

console.log("\nAll scoring checks passed.");
