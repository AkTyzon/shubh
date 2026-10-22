/**
 * Output verification.
 *
 * The check that makes model output usable for a financial decision, so these
 * are the tests that matter most. They assert both directions: a faithful
 * narration passes, and an invented figure is caught — including the realistic
 * failure mode, which is not a wild number but a plausible-sounding rounded one.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlan } from "../lib/plan";
import { checkFigure, parseFigure, verifyAgainstPlan } from "../lib/verify";
import { input } from "./helpers";

const plan = buildPlan(input({ guestCount: 300, totalBudget: 2_500_000, cityTier: "metro" }));
const allowed = plan.verifiedFigures;

describe("figure parsing", () => {
  it("parses plain rupee amounts with Indian grouping", () => {
    assert.equal(parseFigure("6,75,000", undefined), 675_000);
    assert.equal(parseFigure("50000", undefined), 50_000);
    assert.equal(parseFigure("1,000", undefined), 1_000);
  });

  it("applies lakh, crore and thousand multipliers", () => {
    assert.equal(parseFigure("6.75", "lakh"), 675_000);
    assert.equal(parseFigure("1", "crore"), 10_000_000);
    assert.equal(parseFigure("2.5", "cr"), 25_000_000);
    assert.equal(parseFigure("50", "k"), 50_000);
    assert.equal(parseFigure("3", "lakhs"), 300_000);
    assert.equal(parseFigure("3", "lac"), 300_000);
  });

  it("is case-insensitive about the unit", () => {
    assert.equal(parseFigure("5", "LAKH"), 500_000);
    assert.equal(parseFigure("5", "Crore"), 50_000_000);
  });

  it("returns NaN for something that is not a number", () => {
    assert.ok(Number.isNaN(parseFigure("abc", undefined)));
  });
});

describe("extraction from prose", () => {
  it("finds ₹, Rs and INR forms", () => {
    const result = verifyAgainstPlan("₹100 and Rs 200 and Rs. 300 and INR 400", plan);
    assert.deepEqual(
      result.figures.map((figure) => figure.value),
      [100, 200, 300, 400],
    );
  });

  it("ignores bare numbers with no currency marker", () => {
    // Guest counts and day counts are numbers too. Flagging them would make the
    // panel noise, and noise is indistinguishable from no check at all.
    const result = verifyAgainstPlan("300 guests over 4 functions across 180 days", plan);
    assert.equal(result.figures.length, 0);
    assert.ok(result.unquantified);
  });

  it("counts a repeated amount once", () => {
    const result = verifyAgainstPlan("₹2,50,000 for decor. Yes, ₹2,50,000.", plan);
    assert.equal(result.figures.length, 1);
  });

  it("treats the same value written two ways as one claim", () => {
    const result = verifyAgainstPlan("₹2,50,000 — that is ₹2.5 lakh", plan);
    assert.equal(result.figures.length, 1, "de-duplication is by value, not by spelling");
  });
});

describe("checking against the plan", () => {
  it("matches a figure that is in the plan", () => {
    const first = allowed[Math.floor(allowed.length / 2)]!;
    assert.equal(checkFigure(first, allowed), "matched");
  });

  it("calls a figure that is nowhere near the plan invented", () => {
    // Derived rather than hard-coded. The allow-list holds around 60 figures
    // spanning per-plate rates to crore totals, so a magic constant can drift
    // inside somebody's rounding tolerance as the plan's figures change -- which
    // is exactly what happened to an earlier version of this test.
    const farAbove = Math.max(...allowed) * 7 + 13;
    assert.equal(checkFigure(farAbove, allowed), "invented");

    // ₹1 is within the ₹500 floor of the plan's smallest per-guest rate, so only
    // the relative bound rules it out. This is the case that bound exists for.
    assert.equal(checkFigure(1, allowed), "invented");
  });

  it("will not call a figure a rounding of one many times its size", () => {
    const smallest = Math.min(...allowed);
    assert.equal(checkFigure(Math.max(1, Math.round(smallest * 0.1)), allowed), "invented");
  });

  it("leaves no gap wide enough to hide an invented figure between real ones", () => {
    // Widening the allow-list with derived figures makes it denser, and a dense
    // allow-list is a weaker check: more wrong values fall within 2% of
    // something real. This measures that rather than assuming it is fine.
    const sorted = [...allowed].sort((a, b) => a - b);
    let worstOverlap = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i]! - sorted[i - 1]!;
      const tolerance = Math.max(500, sorted[i]! * 0.02) + Math.max(500, sorted[i - 1]! * 0.02);
      if (gap > 0 && gap < tolerance) worstOverlap += 1;
    }
    // Some overlap is expected and harmless -- adjacent figures genuinely are
    // close. It must not be most of the list.
    assert.ok(
      worstOverlap < sorted.length / 2,
      `${worstOverlap} of ${sorted.length} allow-listed figures sit inside each other's ` +
        `tolerance, which would make the check near-vacuous`,
    );
  });

  it("calls a figure within 2% of a real one rounded, not invented", () => {
    const real = plan.budget.lines[0]!.allocated;
    const nudged = Math.round(real * 1.01);
    assert.equal(checkFigure(nudged, allowed), "rounded");
  });

  it("uses a ₹500 floor so small amounts are not all rounded into each other", () => {
    // 2% of ₹1,000 is ₹20, which would make the tolerance meaninglessly tight.
    assert.equal(checkFigure(plan.budget.total + 400, allowed), "rounded");
    assert.equal(checkFigure(plan.budget.total + 100_000, allowed), "invented");
  });

  it("accepts the lakh/crore form the UI itself displays", () => {
    // The plan shows "₹25.00 lakh" for ₹25,00,000, so a model quoting the screen
    // back is quoting the plan correctly. This was a real defect: without
    // `displayedValue` in the allow-list, faithful quotation was flagged.
    const result = verifyAgainstPlan(
      `The typical total here is ₹${(plan.budget.benchmarkTypical / 100_000).toFixed(2)} lakh.`,
      plan,
    );
    assert.equal(result.figures[0]?.status, "matched", JSON.stringify(result.figures[0]));
  });

  it("verifies a full faithful narration with nothing flagged", () => {
    const text = plan.budget.lines
      .map((line) => `${line.label}: ₹${line.allocated.toLocaleString("en-IN")}.`)
      .join(" ");
    const result = verifyAgainstPlan(text, plan);
    assert.equal(result.flagged, 0, JSON.stringify(result.figures.filter((f) => f.status !== "matched")));
    assert.equal(result.matched, result.figures.length);
  });

  it("catches an invented figure inside otherwise correct text", () => {
    const real = plan.budget.lines[0]!.allocated;
    const text = `Catering is ₹${real.toLocaleString("en-IN")}, and set aside ₹47,312 for the pandit.`;
    const result = verifyAgainstPlan(text, plan);

    const invented = result.figures.filter((figure) => figure.status === "invented");
    assert.equal(invented.length, 1);
    assert.equal(invented[0]!.value, 47_312);
    assert.match(invented[0]!.note!, /does not appear/);
  });

  it("names the exact figure a rounded one should have been", () => {
    const real = plan.budget.lines[0]!.allocated;
    const result = verifyAgainstPlan(`About ₹${Math.round(real / 1_000) * 1_000}`, plan);
    const figure = result.figures[0]!;
    if (figure.status === "rounded") {
      assert.ok(figure.matched, "a rounded figure must say what the real one is");
      assert.match(figure.note!, /The computed figure is/);
    } else {
      assert.equal(figure.status, "matched");
    }
  });

  it("reports the tally a reader needs", () => {
    const result = verifyAgainstPlan(`₹${plan.budget.total} and ₹999999999`, plan);
    assert.equal(result.matched, 1);
    assert.equal(result.flagged, 1);
    assert.equal(result.unquantified, false);
  });
});

describe("dates", () => {
  it("matches an ISO date that is in the computed schedule", () => {
    const due = plan.timeline.tasks[0]!.dueDate;
    const result = verifyAgainstPlan(`Book it by ${due}.`, plan);
    assert.equal(result.dates[0]?.status, "matched");
  });

  it("matches the event date itself", () => {
    const result = verifyAgainstPlan(`The wedding is on ${plan.input.eventDate}.`, plan);
    assert.equal(result.dates[0]?.status, "matched");
  });

  it("flags a date that is not in the schedule", () => {
    const result = verifyAgainstPlan("Confirm the caterer by 2027-03-07.", plan);
    const invented = result.dates.find((date) => date.iso === "2027-03-07");
    assert.ok(invented, "the date was not extracted at all");
    assert.equal(invented.status, "invented");
    assert.match(invented.note!, /not in your computed schedule/);
  });

  it("reads the long form a model is likely to write", () => {
    const due = plan.timeline.tasks[0]!.dueDate;
    const [year, month, day] = due.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const long = `${Number(day)} ${months[Number(month) - 1]} ${year}`;
    const result = verifyAgainstPlan(`Due ${long}.`, plan);
    assert.equal(result.dates[0]?.iso, due);
    assert.equal(result.dates[0]?.status, "matched");
  });

  it("reads a full month name too", () => {
    const result = verifyAgainstPlan("Due 7 March 2027.", plan);
    assert.equal(result.dates[0]?.iso, "2027-03-07");
  });

  it("counts a date repeated in two formats once", () => {
    const due = plan.timeline.tasks[0]!.dueDate;
    const result = verifyAgainstPlan(`${due} — that is ${due} again.`, plan);
    assert.equal(result.dates.length, 1);
  });
});

describe("the documented limitation", () => {
  it("passes a correct value attached to the wrong thing", () => {
    // Stated plainly in `lib/verify.ts` and asserted here so it cannot be
    // quietly claimed otherwise: the allow-list is a set of values, not of
    // meanings. This check catches invention, not misattribution.
    const real = plan.budget.lines[0]!.allocated;
    const result = verifyAgainstPlan(`Set aside ₹${real} for the elephant.`, plan);
    assert.equal(result.figures[0]?.status, "matched");
    assert.equal(result.flagged, 0);
  });
});

describe("robustness", () => {
  it("handles empty text", () => {
    const result = verifyAgainstPlan("", plan);
    assert.equal(result.figures.length, 0);
    assert.equal(result.dates.length, 0);
    assert.ok(result.unquantified);
  });

  it("ignores a zero or negative amount rather than flagging it", () => {
    const result = verifyAgainstPlan("₹0 and ₹-5", plan);
    assert.equal(result.figures.filter((figure) => figure.value <= 0).length, 0);
  });

  it("is not confused by markdown around a figure", () => {
    const result = verifyAgainstPlan(`**₹${plan.budget.total}** and _₹999_`, plan);
    assert.equal(result.figures.length, 2);
  });

  it("survives a very long text without stalling", () => {
    const text = `₹${plan.budget.total} `.repeat(5_000);
    const result = verifyAgainstPlan(text, plan);
    assert.equal(result.figures.length, 1);
  });

  it("resets its regex state between calls", () => {
    // `FIGURE_PATTERN` is a module-level global regex. If `lastIndex` were not
    // reset, the second call would start mid-string and silently miss figures.
    const text = `₹${plan.budget.total}`;
    const first = verifyAgainstPlan(text, plan);
    const second = verifyAgainstPlan(text, plan);
    assert.deepEqual(first, second);
  });
});
