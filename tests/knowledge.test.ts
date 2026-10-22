/**
 * The knowledge modules police themselves at import time. These tests assert
 * that the guards are real — that a broken table would actually be caught rather
 * than quietly producing a budget that does not add up.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CITY_TIERS as TIER_LIST,
  COST_CATEGORIES,
  categoriesFor,
  findCategory,
} from "../lib/knowledge/costs";
import { bandFor, IDEAS, ideasFor } from "../lib/knowledge/ideas";
import { minimumNoticeDays, TASK_TEMPLATES, tasksFor } from "../lib/knowledge/timelines";
import { CITY_TIERS, EVENT_TYPES } from "./helpers";

describe("cost benchmarks", () => {
  it("has categories for every event type", () => {
    for (const eventType of EVENT_TYPES) {
      assert.ok(categoriesFor(eventType).length > 0, `${eventType} has no categories`);
    }
  });

  it("shares sum to exactly 100% for every event type, in basis points", () => {
    for (const eventType of EVENT_TYPES) {
      const basisPoints = categoriesFor(eventType).reduce(
        (sum, category) => sum + Math.round(category.share * 10_000),
        0,
      );
      assert.equal(basisPoints, 10_000, `${eventType} shares sum to ${basisPoints / 100}%`);
    }
  });

  it("gives every category a benchmark for every city tier", () => {
    for (const eventType of EVENT_TYPES) {
      for (const category of categoriesFor(eventType)) {
        for (const tier of CITY_TIERS) {
          const range = category.benchmarks[tier];
          assert.ok(range, `${eventType}/${category.id} missing ${tier}`);
          assert.ok(range.low > 0, `${eventType}/${category.id}/${tier} low must be positive`);
        }
      }
    }
  });

  it("orders every benchmark range low <= typical <= high", () => {
    for (const eventType of EVENT_TYPES) {
      for (const category of categoriesFor(eventType)) {
        for (const tier of CITY_TIERS) {
          const { low, typical, high } = category.benchmarks[tier];
          assert.ok(low <= typical, `${eventType}/${category.id}/${tier}: low > typical`);
          assert.ok(typical <= high, `${eventType}/${category.id}/${tier}: typical > high`);
        }
      }
    }
  });

  it("prices a metro above a tier-3 town for every category", () => {
    // The single strongest cost signal in Indian event planning. If this ever
    // inverts, a benchmark has been mistyped.
    for (const eventType of EVENT_TYPES) {
      for (const category of categoriesFor(eventType)) {
        assert.ok(
          category.benchmarks.metro.typical >= category.benchmarks.tier3.typical,
          `${eventType}/${category.id}: metro is cheaper than tier 3`,
        );
      }
    }
  });

  it("uses unique category ids within an event type", () => {
    for (const eventType of EVENT_TYPES) {
      const ids = categoriesFor(eventType).map((category) => category.id);
      assert.equal(new Set(ids).size, ids.length, `${eventType} has duplicate category ids`);
    }
  });

  it("describes what every category covers", () => {
    for (const eventType of EVENT_TYPES) {
      for (const category of categoriesFor(eventType)) {
        assert.ok(
          category.covers.length > 20,
          `${eventType}/${category.id} has no useful description`,
        );
      }
    }
  });

  it("keeps at least one non-optional category per event type", () => {
    for (const eventType of EVENT_TYPES) {
      assert.ok(
        categoriesFor(eventType).some((category) => !category.optional),
        `${eventType} is entirely optional, which cannot be right`,
      );
    }
  });

  it("finds a category by id and returns undefined for an unknown one", () => {
    assert.equal(findCategory("wedding", "catering")?.label, "Catering");
    assert.equal(findCategory("wedding", "elephant"), undefined);
  });

  it("lists four city tiers with examples", () => {
    assert.equal(TIER_LIST.length, 4);
    for (const tier of TIER_LIST) assert.ok(tier.examples.length > 5, `${tier.id} has no examples`);
  });
});

describe("task templates", () => {
  it("has tasks for every event type", () => {
    for (const eventType of EVENT_TYPES) {
      assert.ok(tasksFor(eventType).length > 0, `${eventType} has no tasks`);
    }
  });

  it("uses unique task ids within an event type", () => {
    for (const eventType of EVENT_TYPES) {
      const ids = tasksFor(eventType).map((task) => task.id);
      assert.equal(new Set(ids).size, ids.length, `${eventType} has duplicate task ids`);
    }
  });

  it("declares only dependencies that exist", () => {
    for (const eventType of EVENT_TYPES) {
      const ids = new Set(tasksFor(eventType).map((task) => task.id));
      for (const task of tasksFor(eventType)) {
        for (const dependency of task.dependsOn) {
          assert.ok(ids.has(dependency), `${eventType}/${task.id} depends on unknown ${dependency}`);
        }
      }
    }
  });

  it("gives every dependency a longer lead time than its dependent", () => {
    // The ordering invariant. If a prerequisite has a shorter lead time it is
    // scheduled later than the thing that needs it, which is incoherent.
    for (const eventType of EVENT_TYPES) {
      const byId = new Map(tasksFor(eventType).map((task) => [task.id, task]));
      for (const task of tasksFor(eventType)) {
        for (const dependency of task.dependsOn) {
          const parent = byId.get(dependency)!;
          assert.ok(
            parent.leadDays > task.leadDays,
            `${eventType}: ${dependency} (${parent.leadDays}d) must lead ${task.id} (${task.leadDays}d)`,
          );
        }
      }
    }
  });

  it("has no dependency cycles", () => {
    for (const eventType of EVENT_TYPES) {
      const byId = new Map(tasksFor(eventType).map((task) => [task.id, task]));
      const state = new Map<string, "visiting" | "done">();

      const walk = (id: string, trail: string[]): void => {
        if (state.get(id) === "done") return;
        assert.notEqual(
          state.get(id),
          "visiting",
          `${eventType} has a cycle: ${[...trail, id].join(" -> ")}`,
        );
        state.set(id, "visiting");
        for (const dependency of byId.get(id)!.dependsOn) walk(dependency, [...trail, id]);
        state.set(id, "done");
      };

      for (const task of tasksFor(eventType)) walk(task.id, []);
    }
  });

  it("explains why every task has its deadline", () => {
    for (const eventType of EVENT_TYPES) {
      for (const task of tasksFor(eventType)) {
        assert.ok(task.why.length > 25, `${eventType}/${task.id} has no useful reason`);
      }
    }
  });

  it("gives every task a positive lead time", () => {
    for (const eventType of EVENT_TYPES) {
      for (const task of tasksFor(eventType)) {
        assert.ok(task.leadDays > 0, `${eventType}/${task.id} has lead time ${task.leadDays}`);
      }
    }
  });

  it("reports minimum notice as the longest lead time", () => {
    for (const eventType of EVENT_TYPES) {
      const longest = Math.max(...tasksFor(eventType).map((task) => task.leadDays));
      assert.equal(minimumNoticeDays(eventType), longest, `${eventType} notice mismatch`);
    }
  });

  it("needs more notice for a wedding than for a birthday", () => {
    assert.ok(minimumNoticeDays("wedding") > minimumNoticeDays("birthday"));
  });

  it("points every categoryId at a real cost category", () => {
    for (const eventType of EVENT_TYPES) {
      const categoryIds = new Set(COST_CATEGORIES[eventType].map((category) => category.id));
      for (const task of TASK_TEMPLATES[eventType]) {
        if (!task.categoryId) continue;
        assert.ok(
          categoryIds.has(task.categoryId),
          `${eventType}/${task.id} books unknown category ${task.categoryId}`,
        );
      }
    }
  });
});

describe("ideas catalogue", () => {
  it("has ideas for every event type", () => {
    for (const eventType of EVENT_TYPES) {
      assert.ok(IDEAS[eventType].length > 0, `${eventType} has no ideas`);
    }
  });

  it("returns at least three tier-independent ideas for every band and tier", () => {
    // The no-API-key fallback renders these. An empty ideas section would be the
    // most visible possible failure of the zero-credential path.
    for (const eventType of EVENT_TYPES) {
      for (const band of ["tight", "moderate", "generous"] as const) {
        for (const tier of CITY_TIERS) {
          const found = ideasFor(eventType, band, tier);
          assert.ok(
            found.length >= 3,
            `${eventType}/${band}/${tier} has only ${found.length} ideas`,
          );
        }
      }
    }
  });

  it("names no rupee figure in any idea", () => {
    // Ideas are hand-written. A price in one would be a number outside the
    // computed plan, which is the one thing this project does not do.
    for (const eventType of EVENT_TYPES) {
      for (const idea of IDEAS[eventType]) {
        const text = `${idea.title} ${idea.detail} ${idea.why}`;
        assert.ok(!/₹|\bRs\.?\s?\d|\blakh\b|\bcrore\b/i.test(text), `${idea.id} names a price`);
      }
    }
  });

  it("gives every idea a reason", () => {
    for (const eventType of EVENT_TYPES) {
      for (const idea of IDEAS[eventType]) {
        assert.ok(idea.why.length > 30, `${idea.id} has no useful reason`);
        assert.ok(idea.bands.length > 0, `${idea.id} suits no budget band`);
      }
    }
  });

  it("uses unique idea ids", () => {
    for (const eventType of EVENT_TYPES) {
      const ids = IDEAS[eventType].map((idea) => idea.id);
      assert.equal(new Set(ids).size, ids.length, `${eventType} has duplicate idea ids`);
    }
  });

  it("maps budget ratios to bands at the documented thresholds", () => {
    assert.equal(bandFor(0.5), "tight");
    assert.equal(bandFor(0.84), "tight");
    assert.equal(bandFor(0.85), "moderate");
    assert.equal(bandFor(1.0), "moderate");
    assert.equal(bandFor(1.15), "moderate");
    assert.equal(bandFor(1.16), "generous");
    assert.equal(bandFor(3), "generous");
  });
});
