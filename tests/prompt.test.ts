/**
 * The prompts.
 *
 * Asserted rather than eyeballed, because the rules in them are the contract
 * that keeps the model out of the arithmetic. A prompt edit that drops "do not
 * invent a figure" would not break a build or fail any other test, and the
 * product's central claim would quietly become untrue.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COST_CATEGORIES } from "../lib/knowledge/costs";
import { buildPlanNarrativePrompt, buildQuestionPrompt, buildUserPrompt } from "../lib/prompt";
import { EVENT_TYPES } from "./helpers";

describe("the rules are stated for every event type", () => {
  for (const eventType of EVENT_TYPES) {
    it(`forbids inventing figures and dates for ${eventType}`, () => {
      for (const prompt of [buildPlanNarrativePrompt(eventType), buildQuestionPrompt(eventType)]) {
        assert.match(prompt, /Invent a rupee figure/);
        assert.match(prompt, /Invent a date/);
        assert.match(prompt, /already\s+\*\*computed\*\*|already[\s\S]{0,20}computed/);
      }
    });

    it(`tells the model its output is verified for ${eventType}`, () => {
      // Telling a model the truth about being checked works better than asking
      // it to be careful, and it is true -- see lib/verify.ts.
      const prompt = buildPlanNarrativePrompt(eventType);
      // The prompt is hard-wrapped, so the phrase spans a line break.
      assert.match(prompt, /checked against the computed\s+plan/);
      assert.match(prompt, /marked as invented/);
    });

    it(`forbids re-planning the budget for ${eventType}`, () => {
      assert.match(buildPlanNarrativePrompt(eventType), /Re-plan the budget/);
    });

    it(`forbids rounding into vagueness for ${eventType}`, () => {
      assert.match(buildPlanNarrativePrompt(eventType), /Round a figure into vagueness/);
    });

    it(`describes ${eventType} in terms specific to it`, () => {
      const prompt = buildPlanNarrativePrompt(eventType);
      const expected: Record<string, RegExp> = {
        wedding: /haldi|mehendi|sangeet/,
        birthday: /child|cake/,
        "griha-pravesh": /muhurat|puja/,
        community: /festival|volunteer|permission/,
      };
      assert.match(prompt, expected[eventType]!);
    });

    it(`lists only ${eventType}'s own budget categories`, () => {
      const prompt = buildPlanNarrativePrompt(eventType);
      for (const category of COST_CATEGORIES[eventType]) {
        assert.ok(prompt.includes(category.label), `${category.label} is missing from the prompt`);
      }
      // A category from another event type must not leak in: it would invite the
      // model to discuss a line the plan does not contain.
      const foreign = EVENT_TYPES.filter((other) => other !== eventType).flatMap((other) =>
        COST_CATEGORIES[other].map((category) => category.id),
      );
      const own = new Set(COST_CATEGORIES[eventType].map((category) => category.id));
      for (const id of foreign) {
        if (own.has(id)) continue;
        assert.ok(!prompt.includes(`(${id})`), `${id} leaked into the ${eventType} prompt`);
      }
    });
  }
});

describe("the narrative prompt", () => {
  it("asks for exactly the four sections the UI renders", () => {
    const prompt = buildPlanNarrativePrompt("wedding");
    for (const heading of [
      "## Where you stand",
      "## What to do first",
      "## Ideas for this celebration",
      "## What to watch",
    ]) {
      assert.ok(prompt.includes(heading), `missing "${heading}"`);
    }
    assert.match(prompt, /only these/);
  });

  it("says plainly that a cheerful plan for an impossible event is harmful", () => {
    assert.match(buildPlanNarrativePrompt("wedding"), /most harmful thing/);
  });
});

describe("the question prompt", () => {
  it("tells the model to decline rather than estimate", () => {
    const prompt = buildQuestionPrompt("wedding");
    assert.match(prompt, /say so plainly/);
    assert.match(prompt, /rather than estimating/);
  });

  it("asks for a short answer", () => {
    assert.match(buildQuestionPrompt("wedding"), /Keep it short/);
  });
});

describe("the user message", () => {
  it("wraps the plan in delimiters so it reads as data", () => {
    const message = buildUserPrompt("TOTAL BUDGET: ₹100");
    assert.match(message, /--- BEGIN COMPUTED PLAN ---/);
    assert.match(message, /--- END COMPUTED PLAN ---/);
    assert.ok(message.includes("TOTAL BUDGET: ₹100"));
  });

  it("asks for the four sections when there is no question", () => {
    assert.match(buildUserPrompt("plan"), /Write the four sections/);
  });

  it("leads with the question when there is one", () => {
    const message = buildUserPrompt("plan", "Can I cut the decor?");
    assert.match(message, /The user asks:/);
    assert.ok(message.includes("Can I cut the decor?"));
    assert.ok(!message.includes("Write the four sections"));
  });

  it("treats a blank question as no question", () => {
    assert.match(buildUserPrompt("plan", "   "), /Write the four sections/);
  });

  it("repeats the verification warning after the plan", () => {
    // Last instruction before generation, which is where it has most effect.
    const message = buildUserPrompt("plan");
    const tail = message.slice(message.indexOf("--- END COMPUTED PLAN ---"));
    assert.match(tail, /checked against this plan/);
  });
});
