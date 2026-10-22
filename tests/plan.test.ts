/**
 * Input validation and plan assembly.
 *
 * Validation errors are asserted to name their field and say what would be
 * acceptable. An error that only says "invalid" leaves the user guessing, and
 * guessing at a form is how people give up.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlan,
  EVENT_TYPES as EVENT_TYPE_LIST,
  LIMITS,
  parsePlanInput,
  planAsContext,
  PlanInputError,
} from "../lib/plan";
import { addDays } from "../lib/timeline";
import { verifyAgainstPlan } from "../lib/verify";
import { CITY_TIERS, EVENT_TYPES, input, intBetween, pick, seeded, TODAY } from "./helpers";

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventType: "wedding",
    eventDate: "2027-07-19",
    guestCount: "300",
    cityTier: "metro",
    totalBudget: "2500000",
    today: TODAY,
    ...overrides,
  };
}

describe("input validation", () => {
  it("accepts a well-formed plan and normalises the strings", () => {
    const parsed = parsePlanInput(raw());
    assert.equal(parsed.guestCount, 300);
    assert.equal(parsed.totalBudget, 2_500_000);
    assert.equal(parsed.eventType, "wedding");
  });

  it("rejects a non-object body", () => {
    for (const bad of [null, undefined, "wedding", 42, []]) {
      assert.throws(() => parsePlanInput(bad), PlanInputError, `accepted ${JSON.stringify(bad)}`);
    }
  });

  it("names the field on every error", () => {
    const cases: [Record<string, unknown>, string][] = [
      [raw({ eventType: "bar-mitzvah" }), "eventType"],
      [raw({ cityTier: "village" }), "cityTier"],
      [raw({ guestCount: "0" }), "guestCount"],
      [raw({ totalBudget: "10" }), "totalBudget"],
      [raw({ eventDate: "not-a-date" }), "eventDate"],
      [raw({ today: "nonsense" }), "today"],
    ];
    for (const [body, field] of cases) {
      try {
        parsePlanInput(body);
        assert.fail(`${field} was accepted when it should not have been`);
      } catch (error) {
        assert.ok(error instanceof PlanInputError);
        assert.equal(error.field, field);
        assert.ok(error.message.length > 15, `the ${field} message is too thin to act on`);
      }
    }
  });

  it("states the acceptable range in a range error", () => {
    try {
      parsePlanInput(raw({ guestCount: "999999" }));
      assert.fail("accepted an absurd guest count");
    } catch (error) {
      assert.ok(error instanceof PlanInputError);
      assert.match(error.message, new RegExp(String(LIMITS.maxGuests)));
    }
  });

  it("enforces the guest and budget bounds at both ends", () => {
    assert.doesNotThrow(() => parsePlanInput(raw({ guestCount: String(LIMITS.minGuests) })));
    assert.doesNotThrow(() => parsePlanInput(raw({ guestCount: String(LIMITS.maxGuests) })));
    assert.throws(() => parsePlanInput(raw({ guestCount: String(LIMITS.minGuests - 1) })));
    assert.throws(() => parsePlanInput(raw({ guestCount: String(LIMITS.maxGuests + 1) })));
    assert.doesNotThrow(() => parsePlanInput(raw({ totalBudget: String(LIMITS.minBudget) })));
    assert.throws(() => parsePlanInput(raw({ totalBudget: String(LIMITS.minBudget - 1) })));
  });

  it("refuses a date beyond the horizon where benchmarks mean anything", () => {
    const tooFar = addDays(TODAY, LIMITS.maxDaysAhead + 10);
    try {
      parsePlanInput(raw({ eventDate: tooFar }));
      assert.fail("accepted a date a decade out");
    } catch (error) {
      assert.ok(error instanceof PlanInputError);
      assert.equal(error.field, "eventDate");
      assert.match(error.message, /benchmarks/);
    }
  });

  it("accepts a date in the past, because the engines report on it rather than refusing", () => {
    // Someone pasting a shared link after the event should see what happened to
    // the plan, not a validation error.
    const parsed = parsePlanInput(raw({ eventDate: addDays(TODAY, -30) }));
    assert.equal(parsed.eventDate, addDays(TODAY, -30));
  });

  it("drops priority ids that are not categories of this event type", () => {
    const parsed = parsePlanInput(
      raw({ priorities: ["catering", "elephant", "return-gifts"] }),
    );
    assert.ok(parsed.priorities!.includes("catering"));
    assert.ok(!parsed.priorities!.includes("elephant"));
  });

  it("does not carry a wedding category over to a birthday", () => {
    const parsed = parsePlanInput(raw({ eventType: "birthday", priorities: ["mehendi"] }));
    assert.equal(parsed.priorities!.length, 0);
  });

  it("ignores a non-array priorities value", () => {
    assert.deepEqual(parsePlanInput(raw({ priorities: "catering" })).priorities, []);
  });

  it("trims and caps the free-text city", () => {
    assert.equal(parsePlanInput(raw({ city: "  Nagpur  " })).city, "Nagpur");
    assert.equal(parsePlanInput(raw({ city: "x".repeat(500) })).city!.length, 60);
  });

  it("rounds a fractional guest count rather than carrying it", () => {
    assert.equal(parsePlanInput(raw({ guestCount: "250.6" })).guestCount, 251);
  });

  it("defaults today to the clock when it is absent", () => {
    const parsed = parsePlanInput({ ...raw(), today: undefined });
    assert.match(parsed.today, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("lists four event types, each with a description", () => {
    assert.equal(EVENT_TYPE_LIST.length, 4);
    for (const type of EVENT_TYPE_LIST) {
      assert.ok(type.blurb.length > 20, `${type.id} has no useful description`);
    }
  });
});

describe("plan assembly", () => {
  it("returns a budget, a schedule, findings and an allow-list", () => {
    const plan = buildPlan(input());
    assert.ok(plan.budget.lines.length > 0);
    assert.ok(plan.timeline.tasks.length > 0);
    assert.ok(Array.isArray(plan.issues));
    assert.ok(plan.verifiedFigures.length > 0);
  });

  it("is deterministic: the same input always gives the same plan", () => {
    // The property that distinguishes this from asking a model twice.
    const plan = input({ eventDate: "2027-09-09", priorities: ["catering"] });
    assert.deepEqual(buildPlan(plan), buildPlan(plan));
  });

  it("works for every event type and city tier", () => {
    for (const eventType of EVENT_TYPES) {
      for (const cityTier of CITY_TIERS) {
        const plan = buildPlan(input({ eventType, cityTier }));
        assert.equal(plan.budget.allocated, plan.budget.total, `${eventType}/${cityTier}`);
      }
    }
  });

  it("sorts the allow-list ascending with no duplicates", () => {
    const figures = buildPlan(input()).verifiedFigures;
    for (let i = 1; i < figures.length; i += 1) {
      assert.ok(figures[i]! > figures[i - 1]!, "the allow-list is unsorted or has duplicates");
    }
  });

  it("puts every allocation and benchmark bound in the allow-list", () => {
    const plan = buildPlan(input());
    const figures = new Set(plan.verifiedFigures);
    assert.ok(figures.has(plan.budget.total));
    assert.ok(figures.has(plan.budget.contingency));
    assert.ok(figures.has(plan.budget.perGuest));
    for (const line of plan.budget.lines) {
      assert.ok(figures.has(line.allocated), `${line.categoryId} allocation is not allow-listed`);
      assert.ok(figures.has(line.benchmark.low), `${line.categoryId} low is not allow-listed`);
      assert.ok(figures.has(line.benchmark.high), `${line.categoryId} high is not allow-listed`);
    }
  });

  it("never produces an empty allow-list, which would flag everything", () => {
    const random = seeded(5_150);
    for (let i = 0; i < 100; i += 1) {
      const plan = buildPlan(
        input({
          eventType: pick(random, EVENT_TYPES),
          guestCount: intBetween(random, 2, 3_000),
          totalBudget: intBetween(random, 1_000, 100_000_000),
        }),
      );
      assert.ok(plan.verifiedFigures.length >= 5, "allow-list is suspiciously small");
    }
  });
});

describe("the model's context", () => {
  it("states every allocation and every scheduled date", () => {
    const plan = buildPlan(input());
    const context = planAsContext(plan);
    for (const line of plan.budget.lines) {
      assert.ok(context.includes(String(line.allocated)), `${line.categoryId} is missing`);
    }
    for (const task of plan.timeline.tasks) {
      assert.ok(context.includes(task.dueDate), `${task.id}'s date is missing`);
    }
  });

  it("tells the model these are the only figures and dates that exist", () => {
    const context = planAsContext(buildPlan(input()));
    assert.match(context, /only budget figures that exist/);
    assert.match(context, /only dates that exist/);
  });

  it("includes the findings so the model does not contradict them", () => {
    const plan = buildPlan(
      input({ guestCount: 400, totalBudget: 300_000, eventDate: addDays(TODAY, 150) }),
    );
    const context = planAsContext(plan);
    assert.match(context, /ISSUES THE ENGINE FOUND/);
    for (const issue of plan.issues) assert.ok(context.includes(issue.title));
  });

  it("verifies clean against its own plan", () => {
    // The context is run through the real verifier rather than a hand-rolled
    // regex. If the context carried a figure outside the allow-list, a model
    // repeating it faithfully would be reported as having invented it -- so this
    // asserts the context cannot set the model up to fail.
    const random = seeded(606);
    for (let i = 0; i < 60; i += 1) {
      const plan = buildPlan(
        input({
          eventType: pick(random, EVENT_TYPES),
          cityTier: pick(random, CITY_TIERS),
          guestCount: intBetween(random, 10, 1_200),
          totalBudget: intBetween(random, 50_000, 30_000_000),
          eventDate: addDays(TODAY, intBetween(random, 5, 500)),
        }),
      );
      const result = verifyAgainstPlan(planAsContext(plan), plan);
      assert.equal(
        result.flagged,
        0,
        `the context given to the model does not verify against its own plan: ` +
          JSON.stringify(
            [...result.figures, ...result.dates].filter(
              (entry) => entry.status !== "matched",
            ),
          ),
      );
    }
  });
});
