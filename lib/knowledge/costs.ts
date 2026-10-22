/**
 * Cost benchmarks for Indian celebrations.
 *
 * This file is the project's domain knowledge and the reference every computed
 * figure is checked against. Nothing here is generated at runtime; a language
 * model never supplies a rate. That is the whole point — a benchmark a model
 * invented could not be used to tell a planner their quote is too high.
 *
 * **Accuracy and its limits, stated plainly.** These are indicative 2026 market
 * ranges gathered from how Indian vendors actually price: per-plate for food,
 * flat engagement fees for photographers and priests, hall hire stepped by
 * capacity. They are *not* quotes. Prices move with season (a November wedding
 * date costs more than a June one), with day of week, and enormously between
 * neighbourhoods inside the same city. The UI says so wherever a range appears.
 *
 * Where a number was uncertain the range was widened rather than guessed
 * precisely — an honest band beats a false point estimate, because the product's
 * claim is "this is roughly what things cost", not "this is your price".
 *
 * `share` values define how a budget is split. They are asserted to sum to
 * exactly 1 per event type at module load, so a mistyped percentage fails at
 * startup instead of silently producing a budget that does not add up.
 */

import type { CostCategory, CityTier, EventTypeId } from "../types";

/** How city tiers are meant to be read, shown in the UI so the choice is informed. */
export const CITY_TIERS: { id: CityTier; label: string; examples: string }[] = [
  { id: "metro", label: "Metro", examples: "Mumbai, Delhi NCR, Bengaluru" },
  { id: "tier1", label: "Tier 1", examples: "Pune, Hyderabad, Chennai, Kolkata, Ahmedabad" },
  { id: "tier2", label: "Tier 2", examples: "Jaipur, Lucknow, Indore, Kochi, Bhopal" },
  { id: "tier3", label: "Tier 3", examples: "District towns and smaller cities" },
];

const WEDDING: CostCategory[] = [
  {
    id: "catering",
    label: "Catering",
    covers: "Food and beverages across all functions, service staff, crockery.",
    basis: "per-guest",
    share: 0.3,
    optional: false,
    benchmarks: {
      metro: { low: 1200, typical: 1800, high: 3000 },
      tier1: { low: 800, typical: 1200, high: 2000 },
      tier2: { low: 500, typical: 800, high: 1400 },
      tier3: { low: 350, typical: 550, high: 900 },
    },
  },
  {
    id: "venue",
    label: "Venue",
    covers: "Hall or lawn hire for the main function, basic furniture, power backup.",
    basis: "flat-by-size",
    share: 0.2,
    optional: false,
    benchmarks: {
      metro: { low: 200_000, typical: 450_000, high: 1_200_000 },
      tier1: { low: 100_000, typical: 250_000, high: 600_000 },
      tier2: { low: 50_000, typical: 120_000, high: 300_000 },
      tier3: { low: 25_000, typical: 60_000, high: 150_000 },
    },
  },
  {
    id: "decor",
    label: "Decor and mandap",
    covers: "Stage, mandap, floral work, lighting, entrance, seating decor.",
    basis: "flat-by-size",
    share: 0.12,
    optional: false,
    benchmarks: {
      metro: { low: 150_000, typical: 350_000, high: 900_000 },
      tier1: { low: 80_000, typical: 180_000, high: 450_000 },
      tier2: { low: 40_000, typical: 90_000, high: 220_000 },
      tier3: { low: 20_000, typical: 45_000, high: 110_000 },
    },
  },
  {
    id: "photography",
    label: "Photography and video",
    covers: "Full coverage across functions, candid and traditional, album, edited film.",
    basis: "flat",
    share: 0.1,
    optional: false,
    benchmarks: {
      metro: { low: 100_000, typical: 220_000, high: 600_000 },
      tier1: { low: 60_000, typical: 130_000, high: 350_000 },
      tier2: { low: 30_000, typical: 70_000, high: 180_000 },
      tier3: { low: 18_000, typical: 40_000, high: 100_000 },
    },
  },
  {
    id: "attire",
    label: "Attire and jewellery",
    covers: "Outfits for the couple across functions, and rented or bought jewellery.",
    basis: "flat",
    share: 0.1,
    optional: false,
    benchmarks: {
      metro: { low: 150_000, typical: 350_000, high: 1_000_000 },
      tier1: { low: 90_000, typical: 200_000, high: 600_000 },
      tier2: { low: 50_000, typical: 110_000, high: 300_000 },
      tier3: { low: 30_000, typical: 65_000, high: 170_000 },
    },
  },
  {
    id: "entertainment",
    label: "Music and entertainment",
    covers: "DJ and sound, dhol, baraat band, live singers or an anchor if used.",
    basis: "flat",
    share: 0.05,
    optional: true,
    benchmarks: {
      metro: { low: 40_000, typical: 90_000, high: 250_000 },
      tier1: { low: 25_000, typical: 55_000, high: 150_000 },
      tier2: { low: 12_000, typical: 30_000, high: 80_000 },
      tier3: { low: 8_000, typical: 18_000, high: 45_000 },
    },
  },
  {
    id: "grooming",
    label: "Makeup and grooming",
    covers: "Bridal makeup and hair across functions, plus family packages.",
    basis: "flat",
    share: 0.04,
    optional: true,
    benchmarks: {
      metro: { low: 30_000, typical: 75_000, high: 200_000 },
      tier1: { low: 18_000, typical: 45_000, high: 120_000 },
      tier2: { low: 10_000, typical: 25_000, high: 65_000 },
      tier3: { low: 6_000, typical: 15_000, high: 40_000 },
    },
  },
  {
    id: "invitations",
    label: "Invitations and gifts",
    covers: "Printed or digital cards, courier, return gifts and shagun envelopes.",
    basis: "per-guest",
    share: 0.05,
    optional: true,
    benchmarks: {
      metro: { low: 250, typical: 500, high: 1200 },
      tier1: { low: 180, typical: 350, high: 800 },
      tier2: { low: 100, typical: 220, high: 500 },
      tier3: { low: 70, typical: 150, high: 350 },
    },
  },
  {
    id: "rituals",
    label: "Priest and rituals",
    covers: "Pandit dakshina, puja samagri, havan materials, ritual logistics.",
    basis: "flat",
    share: 0.02,
    optional: false,
    benchmarks: {
      metro: { low: 15_000, typical: 35_000, high: 90_000 },
      tier1: { low: 11_000, typical: 25_000, high: 60_000 },
      tier2: { low: 7_000, typical: 15_000, high: 40_000 },
      tier3: { low: 5_000, typical: 11_000, high: 25_000 },
    },
  },
  {
    id: "logistics",
    label: "Transport and stay",
    covers: "Guest pickup, car hire for the couple, rooms for outstation family.",
    basis: "flat",
    share: 0.02,
    optional: true,
    benchmarks: {
      metro: { low: 40_000, typical: 100_000, high: 300_000 },
      tier1: { low: 25_000, typical: 60_000, high: 180_000 },
      tier2: { low: 12_000, typical: 32_000, high: 95_000 },
      tier3: { low: 8_000, typical: 20_000, high: 55_000 },
    },
  },
];

const BIRTHDAY: CostCategory[] = [
  {
    id: "catering",
    label: "Food and cake",
    covers: "Menu for the guest count, the cake, drinks and service.",
    basis: "per-guest",
    share: 0.4,
    optional: false,
    benchmarks: {
      metro: { low: 600, typical: 1100, high: 2200 },
      tier1: { low: 400, typical: 750, high: 1500 },
      tier2: { low: 250, typical: 480, high: 950 },
      tier3: { low: 180, typical: 330, high: 650 },
    },
  },
  {
    id: "venue",
    label: "Venue",
    covers: "Party hall, restaurant private area, club lawn or society clubhouse.",
    basis: "flat-by-size",
    share: 0.2,
    optional: true,
    benchmarks: {
      metro: { low: 20_000, typical: 55_000, high: 150_000 },
      tier1: { low: 12_000, typical: 32_000, high: 85_000 },
      tier2: { low: 6_000, typical: 16_000, high: 45_000 },
      tier3: { low: 3_000, typical: 9_000, high: 25_000 },
    },
  },
  {
    id: "decor",
    label: "Decor and theme",
    covers: "Balloon work, backdrop, themed props, table settings.",
    basis: "flat-by-size",
    share: 0.15,
    optional: true,
    benchmarks: {
      metro: { low: 12_000, typical: 32_000, high: 90_000 },
      tier1: { low: 8_000, typical: 20_000, high: 55_000 },
      tier2: { low: 4_000, typical: 11_000, high: 30_000 },
      tier3: { low: 2_500, typical: 6_500, high: 18_000 },
    },
  },
  {
    id: "entertainment",
    label: "Entertainment",
    covers: "Host or anchor, magician, games, bouncy castle, music.",
    basis: "flat",
    share: 0.12,
    optional: true,
    benchmarks: {
      metro: { low: 10_000, typical: 25_000, high: 70_000 },
      tier1: { low: 6_000, typical: 15_000, high: 42_000 },
      tier2: { low: 3_000, typical: 8_500, high: 24_000 },
      tier3: { low: 2_000, typical: 5_000, high: 14_000 },
    },
  },
  {
    id: "photography",
    label: "Photography",
    covers: "Event photographer, and a short highlights reel if wanted.",
    basis: "flat",
    share: 0.08,
    optional: true,
    benchmarks: {
      metro: { low: 12_000, typical: 28_000, high: 75_000 },
      tier1: { low: 8_000, typical: 18_000, high: 48_000 },
      tier2: { low: 4_000, typical: 10_000, high: 27_000 },
      tier3: { low: 2_500, typical: 6_000, high: 16_000 },
    },
  },
  {
    id: "invitations",
    label: "Invites and return gifts",
    covers: "Digital or printed invites and a return gift per guest.",
    basis: "per-guest",
    share: 0.05,
    optional: true,
    benchmarks: {
      metro: { low: 150, typical: 350, high: 900 },
      tier1: { low: 100, typical: 250, high: 600 },
      tier2: { low: 60, typical: 150, high: 380 },
      tier3: { low: 40, typical: 100, high: 250 },
    },
  },
];

const GRIHA_PRAVESH: CostCategory[] = [
  {
    id: "rituals",
    label: "Puja and pandit",
    covers: "Pandit dakshina, havan samagri, kalash, puja essentials.",
    basis: "flat",
    share: 0.25,
    optional: false,
    benchmarks: {
      metro: { low: 11_000, typical: 25_000, high: 60_000 },
      tier1: { low: 8_000, typical: 18_000, high: 42_000 },
      tier2: { low: 5_000, typical: 12_000, high: 28_000 },
      tier3: { low: 3_500, typical: 8_000, high: 18_000 },
    },
  },
  {
    id: "catering",
    label: "Food",
    covers: "Lunch or dinner for family and neighbours, prasad distribution.",
    basis: "per-guest",
    share: 0.4,
    optional: false,
    benchmarks: {
      metro: { low: 500, typical: 900, high: 1800 },
      tier1: { low: 350, typical: 620, high: 1200 },
      tier2: { low: 220, typical: 400, high: 780 },
      tier3: { low: 150, typical: 280, high: 540 },
    },
  },
  {
    id: "decor",
    label: "Decor",
    covers: "Rangoli, torans, flowers, lamps and entrance decoration.",
    basis: "flat-by-size",
    share: 0.2,
    optional: true,
    benchmarks: {
      metro: { low: 8_000, typical: 22_000, high: 60_000 },
      tier1: { low: 5_000, typical: 14_000, high: 38_000 },
      tier2: { low: 3_000, typical: 8_000, high: 21_000 },
      tier3: { low: 1_800, typical: 5_000, high: 13_000 },
    },
  },
  {
    id: "invitations",
    label: "Invites and gifts",
    covers: "Invitations and a small gift or sweet box per household.",
    basis: "per-guest",
    share: 0.15,
    optional: true,
    benchmarks: {
      metro: { low: 150, typical: 320, high: 750 },
      tier1: { low: 100, typical: 220, high: 520 },
      tier2: { low: 60, typical: 140, high: 330 },
      tier3: { low: 40, typical: 95, high: 220 },
    },
  },
];

const COMMUNITY: CostCategory[] = [
  {
    id: "venue",
    label: "Venue and staging",
    covers: "Society ground or hall, stage, tentage, chairs, power and lighting.",
    basis: "flat-by-size",
    share: 0.3,
    optional: false,
    benchmarks: {
      metro: { low: 30_000, typical: 85_000, high: 250_000 },
      tier1: { low: 18_000, typical: 50_000, high: 150_000 },
      tier2: { low: 9_000, typical: 26_000, high: 80_000 },
      tier3: { low: 5_000, typical: 15_000, high: 45_000 },
    },
  },
  {
    id: "catering",
    label: "Food and refreshments",
    covers: "Prasad, snacks or a full meal depending on the function.",
    basis: "per-guest",
    share: 0.3,
    optional: false,
    benchmarks: {
      metro: { low: 250, typical: 500, high: 1100 },
      tier1: { low: 180, typical: 350, high: 750 },
      tier2: { low: 110, typical: 230, high: 480 },
      tier3: { low: 80, typical: 160, high: 330 },
    },
  },
  {
    id: "entertainment",
    label: "Programme and sound",
    covers: "Sound system, performers, DJ, anchor, competitions and prizes.",
    basis: "flat",
    share: 0.2,
    optional: true,
    benchmarks: {
      metro: { low: 20_000, typical: 55_000, high: 160_000 },
      tier1: { low: 12_000, typical: 33_000, high: 95_000 },
      tier2: { low: 6_000, typical: 18_000, high: 52_000 },
      tier3: { low: 4_000, typical: 10_000, high: 30_000 },
    },
  },
  {
    id: "decor",
    label: "Decor",
    covers: "Backdrop, flowers, lights, banners and signage.",
    basis: "flat-by-size",
    share: 0.12,
    optional: true,
    benchmarks: {
      metro: { low: 15_000, typical: 40_000, high: 110_000 },
      tier1: { low: 9_000, typical: 24_000, high: 68_000 },
      tier2: { low: 5_000, typical: 13_000, high: 38_000 },
      tier3: { low: 3_000, typical: 8_000, high: 22_000 },
    },
  },
  {
    id: "logistics",
    label: "Permissions and logistics",
    covers: "Police and municipal permissions, security, cleaning, waste removal.",
    basis: "flat",
    share: 0.08,
    optional: false,
    benchmarks: {
      metro: { low: 10_000, typical: 28_000, high: 80_000 },
      tier1: { low: 6_000, typical: 17_000, high: 48_000 },
      tier2: { low: 3_500, typical: 9_500, high: 27_000 },
      tier3: { low: 2_000, typical: 5_500, high: 16_000 },
    },
  },
];

export const COST_CATEGORIES: Record<EventTypeId, CostCategory[]> = {
  wedding: WEDDING,
  birthday: BIRTHDAY,
  "griha-pravesh": GRIHA_PRAVESH,
  community: COMMUNITY,
};

/**
 * Shares must sum to exactly 1 per event type.
 *
 * Checked at module load so a mistyped percentage is a startup failure rather
 * than a budget that quietly does not add up — which is the single defect this
 * whole project exists to prevent.
 *
 * Compared in basis points because 0.3 + 0.2 + 0.12 + … is not exactly 1 in
 * binary floating point.
 */
function assertSharesSumToOne(): void {
  for (const [eventType, categories] of Object.entries(COST_CATEGORIES)) {
    const basisPoints = categories.reduce((sum, c) => sum + Math.round(c.share * 10_000), 0);
    if (basisPoints !== 10_000) {
      throw new Error(
        `Cost category shares for "${eventType}" sum to ${basisPoints / 100}%, not 100%. ` +
          `Fix the share values in lib/knowledge/costs.ts.`,
      );
    }
  }
}

assertSharesSumToOne();

export function categoriesFor(eventType: EventTypeId): CostCategory[] {
  return COST_CATEGORIES[eventType];
}

export function findCategory(eventType: EventTypeId, categoryId: string): CostCategory | undefined {
  return COST_CATEGORIES[eventType].find((c) => c.id === categoryId);
}
