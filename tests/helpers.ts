/**
 * Shared test fixtures.
 *
 * `today` is always supplied explicitly. Every engine takes the reference date
 * as an argument rather than reading the clock, which is what makes date
 * assertions stable — a test suite that passes in October and fails in November
 * is not a test suite.
 */

import type { CityTier, EventTypeId, PlanInput } from "../lib/types";

export const TODAY = "2026-10-22";

export function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    eventType: "wedding",
    eventDate: "2027-07-19",
    guestCount: 300,
    cityTier: "metro",
    totalBudget: 2_500_000,
    priorities: [],
    today: TODAY,
    ...overrides,
  };
}

export const EVENT_TYPES: EventTypeId[] = ["wedding", "birthday", "griha-pravesh", "community"];
export const CITY_TIERS: CityTier[] = ["metro", "tier1", "tier2", "tier3"];

/**
 * A small deterministic PRNG.
 *
 * The property tests below sweep hundreds of budget and guest combinations. A
 * seeded generator means a failure is reproducible, which `Math.random()` would
 * not be — and an invariant that fails once in two hundred runs is exactly the
 * kind this project needs to catch.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

export function intBetween(random: () => number, min: number, max: number): number {
  return Math.floor(min + random() * (max - min + 1));
}
