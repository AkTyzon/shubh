/**
 * Plan input as URL state.
 *
 * This is what makes the no-JavaScript path work and what makes a plan
 * shareable, so the round trip is asserted rather than assumed: a link that
 * reopens as a different plan is worse than no link.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlanInput } from "../lib/plan";
import { FIELD, planToQuery, readPlanParams } from "../lib/share";
import { CITY_TIERS, EVENT_TYPES, input, intBetween, pick, seeded } from "./helpers";

function roundTrip(plan = input()) {
  const query = planToQuery(plan);
  const params = Object.fromEntries(new URLSearchParams(query));
  const raw = readPlanParams(params);
  assert.ok(raw, "a query built from a valid plan did not read back");
  return parsePlanInput({ ...raw, today: plan.today });
}

/**
 * Drop keys whose value is undefined.
 *
 * `assert.deepStrictEqual` distinguishes an absent key from one explicitly set
 * to undefined, and an omitted optional city legitimately comes back as the
 * latter. That difference is invisible to every consumer, so it is normalised
 * away rather than asserted on.
 */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

describe("round trip", () => {
  it("returns the same plan it was given", () => {
    const original = input({ city: "Nagpur", priorities: ["catering"] });
    assert.deepEqual(defined(roundTrip(original)), defined(original));
  });

  it("survives every event type and city tier", () => {
    for (const eventType of EVENT_TYPES) {
      for (const cityTier of CITY_TIERS) {
        const original = input({ eventType, cityTier, priorities: [] });
        assert.deepEqual(defined(roundTrip(original)), defined(original), `${eventType}/${cityTier}`);
      }
    }
  });

  it("survives 200 generated plans", () => {
    const random = seeded(90_210);
    for (let i = 0; i < 200; i += 1) {
      const original = input({
        eventType: pick(random, EVENT_TYPES),
        cityTier: pick(random, CITY_TIERS),
        guestCount: intBetween(random, 2, 5_000),
        totalBudget: intBetween(random, 1_000, 400_000_000),
        priorities: [],
      });
      assert.deepEqual(defined(roundTrip(original)), defined(original));
    }
  });

  it("preserves multiple priorities", () => {
    const original = input({ priorities: ["catering", "photography"] });
    assert.deepEqual(roundTrip(original).priorities, ["catering", "photography"]);
  });

  it("preserves a city name with a space in it", () => {
    assert.equal(roundTrip(input({ city: "Navi Mumbai" })).city, "Navi Mumbai");
  });

  it("omits optional fields from the query when they are empty", () => {
    const query = planToQuery(input({ city: undefined, priorities: [] }));
    assert.ok(!query.includes(`${FIELD.city}=`), "an empty city was written to the URL");
    assert.ok(!query.includes(`${FIELD.priorities}=`), "an empty priority list was written");
  });

  it("uses short parameter names so a shared link stays readable", () => {
    for (const key of Object.values(FIELD)) {
      assert.ok(key.length <= 2, `"${key}" is too long for a shareable URL`);
    }
  });
});

describe("reading params", () => {
  it("returns null when an essential field is missing", () => {
    // A half-filled URL shows the empty form rather than an error, because the
    // usual way to get one is an incompletely copied link.
    const complete = Object.fromEntries(new URLSearchParams(planToQuery(input())));
    for (const key of [FIELD.eventType, FIELD.eventDate, FIELD.guestCount, FIELD.totalBudget, FIELD.cityTier]) {
      const partial = { ...complete };
      delete partial[key];
      assert.equal(readPlanParams(partial), null, `a URL without ${key} was accepted`);
    }
  });

  it("returns null for an empty query", () => {
    assert.equal(readPlanParams({}), null);
  });

  it("accepts priorities as a repeated parameter, as a form submits them", () => {
    const params = {
      ...Object.fromEntries(new URLSearchParams(planToQuery(input()))),
      [FIELD.priorities]: ["catering", "venue"],
    };
    const raw = readPlanParams(params)!;
    assert.deepEqual(raw.priorities, ["catering", "venue"]);
  });

  it("accepts priorities as a comma-separated string, as planToQuery writes them", () => {
    const params = {
      ...Object.fromEntries(new URLSearchParams(planToQuery(input()))),
      [FIELD.priorities]: "catering,venue",
    };
    assert.deepEqual(readPlanParams(params)!.priorities, ["catering", "venue"]);
  });

  it("takes the first value when a parameter is repeated", () => {
    const params = {
      ...Object.fromEntries(new URLSearchParams(planToQuery(input()))),
      [FIELD.guestCount]: ["250", "999"],
    };
    assert.equal(readPlanParams(params)!.guestCount, "250");
  });

  it("does no validation of its own, leaving one authority", () => {
    // Two validators would drift, and the drift would be a difference in what
    // the URL and the JSON API each accept.
    const params = {
      ...Object.fromEntries(new URLSearchParams(planToQuery(input()))),
      [FIELD.guestCount]: "-5",
    };
    assert.equal(readPlanParams(params)!.guestCount, "-5");
    assert.throws(() => parsePlanInput(readPlanParams(params)!));
  });

  it("drops a priority that is not a category of the event type", () => {
    const params = {
      ...Object.fromEntries(new URLSearchParams(planToQuery(input({ eventType: "birthday" })))),
      [FIELD.priorities]: "mehendi,cake",
    };
    const parsed = parsePlanInput({ ...readPlanParams(params)!, today: input().today });
    assert.ok(!parsed.priorities!.includes("mehendi"));
  });
});
