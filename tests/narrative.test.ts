/**
 * The deterministic narrative.
 *
 * The headline assertion is the first one: the built-in explanation verifies
 * perfectly against its own plan, for every plan, because every figure in it was
 * read out of that plan. That property is what lets the no-API-key path be the
 * real product rather than a stub, and it is also the baseline a model is
 * measured against.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNarrative } from "../lib/narrative";
import { buildPlan } from "../lib/plan";
import { addDays } from "../lib/timeline";
import { verifyAgainstPlan } from "../lib/verify";
import { CITY_TIERS, EVENT_TYPES, input, intBetween, pick, seeded, TODAY } from "./helpers";

describe("the narrative verifies against its own plan", () => {
  it("flags nothing across 400 generated plans", () => {
    const random = seeded(19_470_815);
    let planCount = 0;
    let figureCount = 0;

    for (let i = 0; i < 400; i += 1) {
      const plan = buildPlan(
        input({
          eventType: pick(random, EVENT_TYPES),
          cityTier: pick(random, CITY_TIERS),
          guestCount: intBetween(random, 2, 2_000),
          totalBudget: intBetween(random, 10_000, 60_000_000),
          eventDate: addDays(TODAY, intBetween(random, -30, 900)),
        }),
      );

      const result = verifyAgainstPlan(buildNarrative(plan), plan);
      assert.equal(
        result.flagged,
        0,
        `the built-in narrative failed its own verification for ` +
          `${plan.input.eventType} ${plan.input.guestCount}g ₹${plan.input.totalBudget} ` +
          `on ${plan.input.eventDate}: ` +
          JSON.stringify(
            [...result.figures, ...result.dates].filter((entry) => entry.status !== "matched"),
          ),
      );
      planCount += 1;
      figureCount += result.figures.length + result.dates.length;
    }

    assert.equal(planCount, 400);
    // A narrative that quoted nothing would pass vacuously, so the sweep has to
    // show that figures were actually being checked.
    assert.ok(figureCount > 1_200, `only ${figureCount} figures were checked across 400 plans`);
  });

  it("never throws, for any plan the validator would accept", () => {
    const random = seeded(777);
    for (let i = 0; i < 200; i += 1) {
      const plan = buildPlan(
        input({
          eventType: pick(random, EVENT_TYPES),
          cityTier: pick(random, CITY_TIERS),
          guestCount: intBetween(random, 2, 5_000),
          totalBudget: intBetween(random, 1_000, 500_000_000),
          eventDate: addDays(TODAY, intBetween(random, -400, 1_800)),
        }),
      );
      assert.doesNotThrow(() => buildNarrative(plan));
    }
  });
});

describe("structure", () => {
  it("uses the same four headings as the model prompt", () => {
    // The UI renders both paths identically, so the structures must match or the
    // fallback looks like a different product.
    const narrative = buildNarrative(buildPlan(input()));
    for (const heading of [
      "## Where you stand",
      "## What to do first",
      "## Ideas for this celebration",
      "## What to watch",
    ]) {
      assert.ok(narrative.includes(heading), `missing "${heading}"`);
    }
  });

  it("is substantial for every event type", () => {
    for (const eventType of EVENT_TYPES) {
      const narrative = buildNarrative(buildPlan(input({ eventType })));
      assert.ok(narrative.length > 1_200, `${eventType} narrative is only ${narrative.length} chars`);
    }
  });

  it("names ideas from the catalogue", () => {
    const narrative = buildNarrative(buildPlan(input()));
    const ideasSection = narrative.split("## Ideas for this celebration")[1]!;
    const bullets = ideasSection.split("\n").filter((line) => line.startsWith("- **"));
    assert.ok(bullets.length >= 3, `only ${bullets.length} ideas were rendered`);
  });
});

describe("it says the right thing about the plan it was given", () => {
  it("leads with the blocker when the plan cannot happen", () => {
    const plan = buildPlan(
      input({ guestCount: 400, totalBudget: 300_000, cityTier: "metro", eventDate: addDays(TODAY, 150) }),
    );
    const narrative = buildNarrative(plan);
    assert.match(narrative, /does not work as stated/);
  });

  it("calls a tight budget tight", () => {
    const plan = buildPlan(
      input({ guestCount: 150, totalBudget: 480_000, cityTier: "tier2", eventDate: addDays(TODAY, 300) }),
    );
    assert.match(buildNarrative(plan), /tight/i);
  });

  it("calls a comfortable budget comfortable", () => {
    const plan = buildPlan(
      input({ guestCount: 60, totalBudget: 5_000_000, cityTier: "tier3", eventDate: addDays(TODAY, 300) }),
    );
    assert.match(buildNarrative(plan), /comfortable/i);
  });

  it("picks ideas that suit a tight budget rather than a generous one", () => {
    const tight = buildNarrative(
      buildPlan(input({ guestCount: 150, totalBudget: 480_000, cityTier: "tier2" })),
    );
    const generous = buildNarrative(
      buildPlan(input({ guestCount: 60, totalBudget: 5_000_000, cityTier: "tier3" })),
    );
    assert.notEqual(tight, generous);
    assert.match(tight, /budget that has to work hard/);
    assert.match(generous, /surplus/);
  });

  it("surfaces overdue tasks first in what to do", () => {
    const plan = buildPlan(input({ eventDate: addDays(TODAY, 60) }));
    const section = buildNarrative(plan).split("## What to do first")[1]!.split("##")[0]!;
    assert.match(section, /\*\*now\*\*/);
  });

  it("always explains that the contingency is inside the budget", () => {
    // The most commonly misread number on the page.
    const narrative = buildNarrative(buildPlan(input()));
    assert.match(narrative, /not added on top of it/);
  });

  it("reports a past event date rather than pretending otherwise", () => {
    const plan = buildPlan(input({ eventDate: addDays(TODAY, -10) }));
    assert.match(buildNarrative(plan), /has already passed|already passed/);
  });

  it("is deterministic for the same plan", () => {
    const plan = buildPlan(input({ eventDate: "2027-06-06" }));
    assert.equal(buildNarrative(plan), buildNarrative(plan));
  });
});
