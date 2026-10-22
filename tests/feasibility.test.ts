/**
 * The feasibility engine — the part willing to say no.
 *
 * These tests assert two things: that an impossible plan is reported as
 * impossible, and that every finding states the arithmetic behind it and gives
 * the planner something to do. A warning without a number is not actionable, and
 * one without an option is not advice.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBudget } from "../lib/budget";
import { findIssues } from "../lib/feasibility";
import { buildTimeline } from "../lib/timeline";
import type { FeasibilityIssue, PlanInput } from "../lib/types";
import { addDays } from "../lib/timeline";
import { EVENT_TYPES, input, intBetween, pick, seeded, TODAY } from "./helpers";

function issuesFor(plan: PlanInput): FeasibilityIssue[] {
  return findIssues(plan, buildBudget(plan), buildTimeline(plan));
}

describe("budget feasibility", () => {
  it("blocks a budget far below what the event costs", () => {
    const issues = issuesFor(
      input({ guestCount: 400, totalBudget: 300_000, cityTier: "metro", eventDate: addDays(TODAY, 150) }),
    );
    const blocker = issues.find((issue) => issue.id === "budget-insufficient");
    assert.ok(blocker, "a ₹3 lakh metro wedding for 400 guests was not blocked");
    assert.equal(blocker.severity, "blocker");
  });

  it("states the per-head figure, the market total and the gap", () => {
    const issues = issuesFor(
      input({ guestCount: 400, totalBudget: 300_000, cityTier: "metro", eventDate: addDays(TODAY, 150) }),
    );
    const blocker = issues.find((issue) => issue.id === "budget-insufficient")!;
    assert.match(blocker.detail, /₹750 a head/);
    assert.match(blocker.detail, /400 guests/);
    assert.match(blocker.detail, /gap of about/);
  });

  it("names the guest count the budget actually covers", () => {
    const issues = issuesFor(
      input({ guestCount: 400, totalBudget: 300_000, cityTier: "metro", eventDate: addDays(TODAY, 150) }),
    );
    const blocker = issues.find((issue) => issue.id === "budget-insufficient")!;
    const reduce = blocker.options.find((option) => option.startsWith("Reduce to"));
    assert.ok(reduce, "no option told the planner what size their money covers");
    const suggested = Number(/roughly (\d+) guests/.exec(reduce)?.[1]);
    assert.ok(suggested > 0 && suggested < 400, `suggested ${suggested} guests, which is no help`);
  });

  it("warns rather than blocks when the budget is merely tight", () => {
    // ₹4.8 lakh for 150 guests in a tier-2 city is 74% of the ₹6.45 lakh
    // typical — under the 85% warning line, above the 65% blocker line.
    const issues = issuesFor(
      input({ guestCount: 150, totalBudget: 480_000, cityTier: "tier2", eventDate: addDays(TODAY, 300) }),
    );
    assert.equal(issues.filter((issue) => issue.severity === "blocker").length, 0);
    assert.ok(issues.some((issue) => issue.id === "budget-tight" || issue.id === "categories-underfunded"));
  });

  it("raises nothing about the budget when it matches the market", () => {
    const issues = issuesFor(
      input({ guestCount: 300, totalBudget: 2_700_000, cityTier: "metro", eventDate: addDays(TODAY, 300) }),
    );
    assert.equal(
      issues.filter((issue) => issue.id === "budget-insufficient" || issue.id === "budget-tight").length,
      0,
    );
  });

  it("flags a per-plate rate below the local market", () => {
    const issues = issuesFor(
      input({ guestCount: 250, totalBudget: 900_000, cityTier: "metro", eventDate: addDays(TODAY, 300) }),
    );
    const perPlate = issues.find((issue) => issue.id === "per-plate-low");
    assert.ok(perPlate, "a low per-plate rate went unreported");
    assert.match(perPlate.detail, /per plate/);
  });

  it("names underfunded categories individually", () => {
    const issues = issuesFor(
      input({ guestCount: 200, totalBudget: 900_000, cityTier: "metro", eventDate: addDays(TODAY, 300) }),
    );
    const underfunded = issues.find((issue) => issue.id === "categories-underfunded");
    if (underfunded) {
      assert.match(underfunded.detail, /against a floor of/);
    }
  });
});

describe("timing feasibility", () => {
  it("blocks a wedding under two weeks away", () => {
    const issues = issuesFor(input({ eventDate: addDays(TODAY, 10) }));
    const blocker = issues.find((issue) => issue.id === "wedding-very-short-notice");
    assert.ok(blocker, "a wedding in ten days was not blocked");
    assert.equal(blocker.severity, "blocker");
  });

  it("does not block a birthday under two weeks away", () => {
    // A birthday in ten days is a normal thing to plan. The short-notice rule is
    // specific to weddings for a reason.
    const issues = issuesFor(
      input({ eventType: "birthday", guestCount: 25, totalBudget: 60_000, eventDate: addDays(TODAY, 10) }),
    );
    assert.equal(
      issues.filter((issue) => issue.id === "wedding-very-short-notice").length,
      0,
    );
  });

  it("reports a compressed timeline with the most pressing task named", () => {
    const issues = issuesFor(input({ eventDate: addDays(TODAY, 120) }));
    const compressed = issues.find((issue) => issue.id === "timeline-compressed");
    assert.ok(compressed, "a 120-day wedding reported no compression");
    assert.match(compressed.detail, /days until/);
    assert.match(compressed.detail, /The most pressing is/);
  });

  it("escalates a severely compressed timeline from warning to blocker", () => {
    const roomy = issuesFor(input({ eventDate: addDays(TODAY, 150) })).find(
      (issue) => issue.id === "timeline-compressed",
    );
    const cramped = issuesFor(input({ eventDate: addDays(TODAY, 40) })).find(
      (issue) => issue.id === "timeline-compressed",
    );
    assert.equal(roomy?.severity, "warning");
    assert.equal(cramped?.severity, "blocker");
  });

  it("blocks a date that has already passed, and says nothing else", () => {
    const issues = issuesFor(input({ eventDate: addDays(TODAY, -10) }));
    const past = issues.find((issue) => issue.id === "date-past");
    assert.ok(past);
    assert.equal(past.severity, "blocker");
    // Once the date has gone, the timeline findings are noise.
    assert.equal(issues.filter((issue) => issue.id === "timeline-compressed").length, 0);
  });

  it("reports nothing on timing when there is ample notice", () => {
    const issues = issuesFor(input({ eventDate: addDays(TODAY, 400) }));
    assert.equal(issues.filter((issue) => issue.id === "timeline-compressed").length, 0);
  });
});

describe("scale", () => {
  it("notes the logistics a very large event needs", () => {
    const issues = issuesFor(
      input({ guestCount: 900, totalBudget: 9_000_000, eventDate: addDays(TODAY, 300) }),
    );
    const large = issues.find((issue) => issue.id === "large-event");
    assert.ok(large, "900 guests raised no logistics note");
    assert.equal(large.severity, "note");
    assert.match(large.detail, /parking/);
  });

  it("says nothing about scale for a normal-sized event", () => {
    const issues = issuesFor(input({ guestCount: 200, eventDate: addDays(TODAY, 300) }));
    assert.equal(issues.filter((issue) => issue.id === "large-event").length, 0);
  });
});

describe("every finding is usable", () => {
  it("sorts blockers before warnings before notes", () => {
    const random = seeded(4_242);
    for (let i = 0; i < 150; i += 1) {
      const issues = issuesFor(
        input({
          eventType: pick(random, EVENT_TYPES),
          guestCount: intBetween(random, 2, 1_200),
          totalBudget: intBetween(random, 5_000, 20_000_000),
          eventDate: addDays(TODAY, intBetween(random, -20, 500)),
        }),
      );
      const rank = { blocker: 0, warning: 1, note: 2 } as const;
      for (let j = 1; j < issues.length; j += 1) {
        assert.ok(
          rank[issues[j - 1]!.severity] <= rank[issues[j]!.severity],
          "issues are out of severity order",
        );
      }
    }
  });

  it("quotes a figure or a day count in every detail", () => {
    const random = seeded(8_080);
    let seen = 0;
    for (let i = 0; i < 150; i += 1) {
      const issues = issuesFor(
        input({
          eventType: pick(random, EVENT_TYPES),
          guestCount: intBetween(random, 2, 1_200),
          totalBudget: intBetween(random, 5_000, 20_000_000),
          eventDate: addDays(TODAY, intBetween(random, -20, 500)),
        }),
      );
      for (const issue of issues) {
        assert.match(
          issue.detail,
          /₹|\d+\s*(day|guest)|\d{2,}/,
          `"${issue.id}" states no concrete number: ${issue.detail}`,
        );
        seen += 1;
      }
    }
    assert.ok(seen > 100, `only ${seen} issues were generated; the sweep is not exercising enough`);
  });

  it("offers at least one concrete option for every finding", () => {
    const random = seeded(1_111);
    for (let i = 0; i < 150; i += 1) {
      const issues = issuesFor(
        input({
          eventType: pick(random, EVENT_TYPES),
          guestCount: intBetween(random, 2, 1_200),
          totalBudget: intBetween(random, 5_000, 20_000_000),
          eventDate: addDays(TODAY, intBetween(random, -20, 500)),
        }),
      );
      for (const issue of issues) {
        assert.ok(issue.options.length > 0, `"${issue.id}" offers nothing to do`);
        for (const option of issue.options) {
          assert.ok(option.length > 15, `"${issue.id}" has a useless option: "${option}"`);
        }
      }
    }
  });

  it("uses a unique id per finding within one plan", () => {
    const issues = issuesFor(
      input({ guestCount: 700, totalBudget: 250_000, eventDate: addDays(TODAY, 20) }),
    );
    const ids = issues.map((issue) => issue.id);
    assert.equal(new Set(ids).size, ids.length, "a finding was emitted twice");
  });

  it("never throws, for any input the validator would accept", () => {
    const random = seeded(31_337);
    for (let i = 0; i < 300; i += 1) {
      const plan = input({
        eventType: pick(random, EVENT_TYPES),
        guestCount: intBetween(random, 2, 5_000),
        totalBudget: intBetween(random, 1_000, 500_000_000),
        eventDate: addDays(TODAY, intBetween(random, -400, 1_800)),
      });
      assert.doesNotThrow(() => issuesFor(plan), `threw for ${JSON.stringify(plan)}`);
    }
  });
});
