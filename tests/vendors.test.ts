/**
 * Vendor checklists.
 *
 * "Vendor checklists" is one of the four things the problem statement names, so
 * these assert both that the content exists for every budget line and that it
 * obeys the rule the rest of the project obeys: no hand-written rupee figure
 * reaches a user, because every figure on the page has to come from the computed
 * plan or the verification panel beside it would be inconsistent with it.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COST_CATEGORIES } from "../lib/knowledge/costs";
import { checklistsFor, checklistsForCategory } from "../lib/knowledge/vendors";
import { EVENT_TYPES } from "./helpers";

describe("coverage", () => {
  it("has checklists for every event type", () => {
    for (const eventType of EVENT_TYPES) {
      assert.ok(checklistsFor(eventType).length > 0, `${eventType} has no checklists`);
    }
  });

  it("covers every budget category of every event type", () => {
    // The gap this closes: four checklists originally pointed at categories that
    // did not exist, so they would never have rendered beside their money.
    for (const eventType of EVENT_TYPES) {
      for (const category of COST_CATEGORIES[eventType]) {
        assert.ok(
          checklistsForCategory(eventType, category.id).length > 0,
          `${eventType}/${category.id} has no vendor checklist`,
        );
      }
    }
  });

  it("points every checklist at a category that exists", () => {
    for (const eventType of EVENT_TYPES) {
      const ids = new Set(COST_CATEGORIES[eventType].map((category) => category.id));
      for (const checklist of checklistsFor(eventType)) {
        assert.ok(
          ids.has(checklist.categoryId),
          `${eventType}: "${checklist.vendorName}" points at unknown "${checklist.categoryId}"`,
        );
      }
    }
  });

  it("names each vendor only once per event type", () => {
    for (const eventType of EVENT_TYPES) {
      const names = checklistsFor(eventType).map((checklist) => checklist.vendorName);
      assert.equal(new Set(names).size, names.length, `${eventType} repeats a vendor name`);
    }
  });

  it("returns an empty array for a category with no checklist", () => {
    assert.deepEqual(checklistsForCategory("wedding", "not-a-category"), []);
  });

  it("allows several checklists to share one category", () => {
    // A birthday cake and the wider menu both come out of catering, and they are
    // different conversations with different people.
    assert.ok(checklistsForCategory("birthday", "catering").length >= 2);
  });
});

describe("every checklist is usable", () => {
  it("asks questions, names what to get in writing, and names red flags", () => {
    for (const eventType of EVENT_TYPES) {
      for (const checklist of checklistsFor(eventType)) {
        const where = `${eventType}/${checklist.vendorName}`;
        assert.ok(checklist.questions.length >= 3, `${where} asks only ${checklist.questions.length} questions`);
        assert.ok(checklist.inWriting.length >= 2, `${where} names too little to get in writing`);
        assert.ok(checklist.redFlags.length >= 2, `${where} names too few red flags`);
        assert.ok(checklist.payment.length > 40, `${where} has no useful payment guidance`);
      }
    }
  });

  it("writes every item as something a planner can act on", () => {
    for (const eventType of EVENT_TYPES) {
      for (const checklist of checklistsFor(eventType)) {
        for (const item of [
          ...checklist.questions,
          ...checklist.inWriting,
          ...checklist.redFlags,
        ]) {
          assert.ok(
            item.length > 20,
            `${eventType}/${checklist.vendorName}: "${item}" is too thin to act on`,
          );
        }
      }
    }
  });

  it("phrases questions as questions", () => {
    for (const eventType of EVENT_TYPES) {
      for (const checklist of checklistsFor(eventType)) {
        for (const question of checklist.questions) {
          assert.ok(
            question.trim().endsWith("?"),
            `${eventType}/${checklist.vendorName}: "${question}" is not a question`,
          );
        }
      }
    }
  });

  it("names no rupee figure anywhere", () => {
    // The invariant. A price written by hand here would be a number in front of
    // the user that the computed plan does not contain, and the verification
    // panel on the same page would then be inconsistent with it. Payment
    // guidance is in milestones and proportions instead.
    for (const eventType of EVENT_TYPES) {
      for (const checklist of checklistsFor(eventType)) {
        const text = [
          checklist.vendorName,
          checklist.payment,
          ...checklist.questions,
          ...checklist.inWriting,
          ...checklist.redFlags,
        ].join(" ");
        assert.ok(
          !/₹|\bRs\.?\s*\d|\blakh\b|\bcrore\b/i.test(text),
          `${eventType}/${checklist.vendorName} names a price`,
        );
      }
    }
  });

  it("gives every vendor a name you could search for", () => {
    for (const eventType of EVENT_TYPES) {
      for (const checklist of checklistsFor(eventType)) {
        assert.ok(checklist.vendorName.length > 3);
        assert.match(checklist.vendorName, /^[A-Z]/, `"${checklist.vendorName}" is not capitalised`);
      }
    }
  });
});

describe("the content covers what actually goes wrong", () => {
  it("makes the caterer state a headcount", () => {
    const catering = checklistsForCategory("wedding", "catering")[0]!;
    assert.match(catering.inWriting.join(" "), /headcount/i);
    assert.match(catering.redFlags.join(" "), /headcount/i);
  });

  it("makes the venue state an overtime rate and cancellation terms", () => {
    const venue = checklistsForCategory("wedding", "venue")[0]!;
    assert.match(venue.inWriting.join(" "), /overtime/i);
    assert.match(venue.inWriting.join(" "), /cancellation/i);
  });

  it("makes the photographer commit to a delivery deadline", () => {
    const photo = checklistsForCategory("wedding", "photography")[0]!;
    assert.match(photo.inWriting.join(" "), /deadline|delivery/i);
  });

  it("puts permissions and crowd safety in the community checklists", () => {
    // These are what actually sink a society function, and neither is a vendor
    // you pay — which is why they could easily have been left out.
    const text = checklistsFor("community")
      .flatMap((checklist) => [
        checklist.vendorName,
        ...checklist.questions,
        ...checklist.inWriting,
        ...checklist.redFlags,
      ])
      .join(" ");
    assert.match(text, /loudspeaker|permission/i);
    assert.match(text, /exit|extinguisher|crowd/i);
  });

  it("builds the griha pravesh checklists around the muhurat", () => {
    const text = checklistsFor("griha-pravesh")
      .flatMap((checklist) => [...checklist.questions, ...checklist.inWriting])
      .join(" ");
    assert.match(text, /samagri|ritual|muhurat/i);
  });
});
