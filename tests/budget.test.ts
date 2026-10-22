/**
 * The budget engine.
 *
 * The first suite is the one that matters: allocations plus contingency must
 * equal the total, exactly, for every input. It is asserted here over hundreds
 * of generated combinations rather than a handful of examples, because rounding
 * bugs hide in specific values and a chosen example will not find them.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  benchmarkFor,
  buildBudget,
  displayedValue,
  formatExact,
  formatMoney,
} from "../lib/budget";
import { categoriesFor } from "../lib/knowledge/costs";
import { CITY_TIERS, EVENT_TYPES, input, intBetween, pick, seeded } from "./helpers";

describe("budget balances exactly", () => {
  it("sums to the total across 600 generated plans", () => {
    const random = seeded(20_261_022);
    let checked = 0;

    for (let i = 0; i < 600; i += 1) {
      const eventType = pick(random, EVENT_TYPES);
      const categories = categoriesFor(eventType);
      const priorities =
        random() < 0.5 ? [pick(random, categories).id] : [];

      const plan = input({
        eventType,
        cityTier: pick(random, CITY_TIERS),
        // Deliberately includes awkward values: primes, odd rupee amounts and
        // tiny budgets are where floor-and-distribute goes wrong.
        guestCount: intBetween(random, 2, 2_000),
        totalBudget: intBetween(random, 1_000, 50_000_000) + intBetween(random, 0, 999),
        priorities,
      });

      const budget = buildBudget(plan);
      const lineSum = budget.lines.reduce((sum, line) => sum + line.allocated, 0);

      assert.equal(
        lineSum + budget.contingency,
        budget.total,
        `lines (${lineSum}) + contingency (${budget.contingency}) != total (${budget.total}) ` +
          `for ${eventType} ${plan.guestCount}g ₹${plan.totalBudget}`,
      );
      assert.equal(budget.allocated, budget.total);
      checked += 1;
    }

    assert.equal(checked, 600);
  });

  it("allocates only whole rupees", () => {
    const random = seeded(7);
    for (let i = 0; i < 200; i += 1) {
      const budget = buildBudget(
        input({
          eventType: pick(random, EVENT_TYPES),
          totalBudget: intBetween(random, 1_337, 9_999_999),
          guestCount: intBetween(random, 3, 900),
        }),
      );
      for (const line of budget.lines) {
        assert.ok(Number.isInteger(line.allocated), `${line.categoryId} got ${line.allocated}`);
      }
      assert.ok(Number.isInteger(budget.contingency));
    }
  });

  it("never allocates a negative amount", () => {
    const random = seeded(99);
    for (let i = 0; i < 100; i += 1) {
      const budget = buildBudget(
        input({ totalBudget: intBetween(random, 1_000, 20_000), guestCount: intBetween(random, 2, 50) }),
      );
      for (const line of budget.lines) assert.ok(line.allocated >= 0, `${line.categoryId} negative`);
    }
  });

  it("holds back 10% as contingency", () => {
    const budget = buildBudget(input({ totalBudget: 1_000_000 }));
    assert.equal(budget.contingency, 100_000);
  });

  it("keeps contingency inside the total, not on top of it", () => {
    const budget = buildBudget(input({ totalBudget: 2_000_000 }));
    const lineSum = budget.lines.reduce((sum, line) => sum + line.allocated, 0);
    assert.equal(lineSum, 2_000_000 - budget.contingency);
    assert.ok(lineSum < budget.total);
  });

  it("produces one line per category, in catalogue order", () => {
    for (const eventType of EVENT_TYPES) {
      const budget = buildBudget(input({ eventType }));
      const expected = categoriesFor(eventType).map((category) => category.id);
      assert.deepEqual(
        budget.lines.map((line) => line.categoryId),
        expected,
      );
    }
  });
});

describe("priorities move money", () => {
  it("funds a priority category more than it would otherwise get", () => {
    const base = buildBudget(input({ priorities: [] }));
    const boosted = buildBudget(input({ priorities: ["catering"] }));

    const baseCatering = base.lines.find((line) => line.categoryId === "catering")!.allocated;
    const boostedCatering = boosted.lines.find((line) => line.categoryId === "catering")!.allocated;

    assert.ok(
      boostedCatering > baseCatering,
      `priority did not raise catering: ${baseCatering} -> ${boostedCatering}`,
    );
  });

  it("takes the money from the other categories, not from thin air", () => {
    const boosted = buildBudget(input({ priorities: ["catering"] }));
    const lineSum = boosted.lines.reduce((sum, line) => sum + line.allocated, 0);
    assert.equal(lineSum + boosted.contingency, boosted.total);
  });

  it("reduces at least one non-priority category", () => {
    const base = buildBudget(input({ priorities: [] }));
    const boosted = buildBudget(input({ priorities: ["catering"] }));

    const reduced = boosted.lines.filter((line) => {
      if (line.categoryId === "catering") return false;
      const before = base.lines.find((other) => other.categoryId === line.categoryId)!;
      return line.allocated < before.allocated;
    });

    assert.ok(reduced.length > 0, "a priority was funded without reducing anything");
  });

  it("still balances with every category marked a priority", () => {
    // Boosting everything is equivalent to boosting nothing, which is a case a
    // naive weighting implementation gets wrong.
    const all = categoriesFor("wedding").map((category) => category.id);
    const budget = buildBudget(input({ priorities: all }));
    const lineSum = budget.lines.reduce((sum, line) => sum + line.allocated, 0);
    assert.equal(lineSum + budget.contingency, budget.total);
  });

  it("ignores an unknown priority id without throwing", () => {
    const budget = buildBudget(input({ priorities: ["not-a-category"] }));
    assert.equal(budget.allocated, budget.total);
  });
});

describe("benchmarks scale correctly", () => {
  it("scales per-guest categories linearly with the headcount", () => {
    const catering = categoriesFor("wedding").find((category) => category.id === "catering")!;
    const forOne = benchmarkFor(catering, 1, "metro");
    const forTwoHundred = benchmarkFor(catering, 200, "metro");
    assert.equal(forTwoHundred.low, forOne.low * 200);
    assert.equal(forTwoHundred.typical, forOne.typical * 200);
  });

  it("leaves flat categories unscaled by the headcount", () => {
    const flat = categoriesFor("wedding").find((category) => category.basis === "flat");
    assert.ok(flat, "the wedding catalogue has no flat category to test");
    assert.deepEqual(benchmarkFor(flat, 50, "metro"), benchmarkFor(flat, 500, "metro"));
  });

  it("scales flat-by-size sub-linearly: double the guests is well under double the cost", () => {
    const sized = categoriesFor("wedding").find((category) => category.basis === "flat-by-size");
    assert.ok(sized, "the wedding catalogue has no flat-by-size category to test");

    const at150 = benchmarkFor(sized, 150, "metro").typical;
    const at300 = benchmarkFor(sized, 300, "metro").typical;

    assert.ok(at300 > at150, "a bigger venue should cost more");
    assert.ok(at300 < at150 * 2, `300 guests cost ${at300 / at150}x of 150, expected under 2x`);
  });

  it("anchors flat-by-size at 150 guests", () => {
    const sized = categoriesFor("wedding").find((category) => category.basis === "flat-by-size")!;
    assert.deepEqual(benchmarkFor(sized, 150, "tier2"), sized.benchmarks.tier2);
  });

  it("costs more in a metro than in a tier-2 city at the same size", () => {
    const metro = buildBudget(input({ cityTier: "metro" }));
    const tier2 = buildBudget(input({ cityTier: "tier2" }));
    assert.ok(metro.benchmarkTypical > tier2.benchmarkTypical);
  });

  it("raises the benchmark total as guests increase", () => {
    const small = buildBudget(input({ guestCount: 100 }));
    const large = buildBudget(input({ guestCount: 400 }));
    assert.ok(large.benchmarkTypical > small.benchmarkTypical);
  });
});

describe("verdicts describe reality", () => {
  it("calls a well-matched budget realistic", () => {
    const budget = buildBudget(input({ guestCount: 300, totalBudget: 2_500_000, cityTier: "metro" }));
    const realistic = budget.lines.filter((line) => line.verdict === "realistic");
    assert.ok(realistic.length > 0, "nothing was realistic at a market-rate budget");
  });

  it("calls a hopeless budget not deliverable", () => {
    const budget = buildBudget(input({ guestCount: 400, totalBudget: 300_000, cityTier: "metro" }));
    assert.ok(
      budget.lines.some((line) => line.verdict === "unrealistic"),
      "a ₹3 lakh metro wedding for 400 produced no unrealistic line",
    );
  });

  it("calls a very large budget generous somewhere", () => {
    const budget = buildBudget(input({ guestCount: 60, totalBudget: 20_000_000, cityTier: "tier3" }));
    assert.ok(budget.lines.some((line) => line.verdict === "generous"));
  });

  it("states the numbers behind every verdict", () => {
    const budget = buildBudget(input({ guestCount: 400, totalBudget: 400_000 }));
    for (const line of budget.lines) {
      assert.ok(line.note.includes("₹"), `${line.categoryId}'s note quotes no figure`);
      assert.ok(line.note.length > 40, `${line.categoryId}'s note is too thin to act on`);
    }
  });

  it("quotes a per-guest figure for per-guest categories", () => {
    const budget = buildBudget(input({ guestCount: 200 }));
    const catering = budget.lines.find((line) => line.categoryId === "catering")!;
    assert.match(catering.note, /per guest/);
  });

  it("suggests dropping an optional category rather than underfunding it", () => {
    const budget = buildBudget(input({ guestCount: 500, totalBudget: 200_000, cityTier: "metro" }));
    const starved = budget.lines.filter(
      (line) => line.optional && line.verdict === "unrealistic",
    );
    assert.ok(starved.length > 0, "no optional category was underfunded in this extreme case");
    for (const line of starved) assert.match(line.note, /dropping it/);
  });
});

describe("money formatting", () => {
  it("groups in the Indian convention, not the Western one", () => {
    // ₹1,200,000 instead of ₹12,00,000 is misread at a glance by exactly this
    // audience, so the grouping is asserted rather than assumed.
    assert.equal(formatExact(1_200_000), "₹12,00,000");
    assert.equal(formatExact(100_000), "₹1,00,000");
    assert.equal(formatExact(1_000), "₹1,000");
  });

  it("switches to lakh and crore where a reader would", () => {
    assert.equal(formatMoney(99_999), "₹99,999");
    assert.equal(formatMoney(100_000), "₹1.00 lakh");
    assert.equal(formatMoney(2_500_000), "₹25.00 lakh");
    assert.equal(formatMoney(10_000_000), "₹1.00 crore");
    assert.equal(formatMoney(25_000_000), "₹2.50 crore");
  });

  it("reports the value a lakh/crore display actually conveys", () => {
    // This is what lets a model quote the screen back without being flagged.
    assert.equal(displayedValue(3_096_234), 3_096_000);
    assert.equal(displayedValue(2_500_000), 2_500_000);
    assert.equal(displayedValue(12_345_678), 12_300_000); // "₹1.23 crore"
    assert.equal(displayedValue(8_333), 8_333);
  });

  it("rounds a fractional rupee rather than displaying one", () => {
    assert.equal(formatExact(1_000.4), "₹1,000");
    assert.equal(formatExact(1_000.6), "₹1,001");
  });
});
