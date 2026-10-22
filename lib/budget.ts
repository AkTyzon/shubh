/**
 * Budget allocation.
 *
 * The engine that makes this project something other than a chat window. A
 * language model asked for a wedding budget will produce a confident, tidy,
 * plausible table whose rows do not sum to the total, whose per-plate rate is
 * invented, and which nobody checks because checking is exactly the work the
 * user was trying to avoid.
 *
 * Here the model never supplies a number. Allocation is arithmetic over the
 * category shares in `knowledge/costs.ts`, and three properties are enforced
 * rather than hoped for:
 *
 * 1. **The parts sum to the whole.** Allocations plus contingency equal the
 *    total budget exactly — asserted before the plan is returned, in whole
 *    rupees so there is no rounding drift to argue about.
 * 2. **Every figure is comparable to reality.** Each line is scored against a
 *    benchmark range for that city tier and guest count, so "₹2,00,000 for
 *    catering" is reported as realistic or as impossible, with the per-plate
 *    maths shown.
 * 3. **Priorities move money, and the cost is named.** Funding a priority takes
 *    the money from somewhere, and the plan says where.
 */

import { categoriesFor } from "./knowledge/costs";
import type {
  BudgetLine,
  BudgetPlan,
  BudgetVerdict,
  CityTier,
  CostCategory,
  CostRange,
  Money,
  PlanInput,
} from "./types";

/**
 * Share of the budget held back for what nobody plans for.
 *
 * Ten per cent is deliberately conservative. Overruns on Indian celebrations are
 * the norm rather than the exception -- an extra fifty guests, a last-minute
 * ritual requirement, transport nobody costed -- and a plan that allocates every
 * rupee is a plan that will be broken in its first week.
 */
const CONTINGENCY_SHARE = 0.1;

/**
 * Extra budget a priority category receives, taken from non-priority ones.
 *
 * Deliberately modest: a priority should visibly shift money without starving
 * everything else, which is what a larger multiplier would do.
 */
const PRIORITY_BOOST = 0.25;

/** Below this fraction of the benchmark low, a category cannot be delivered. */
const UNREALISTIC_FRACTION = 0.6;

/**
 * Scale a flat benchmark by guest count.
 *
 * Venue hire and decor are quoted flat, but a flat quote is for a typical event.
 * Anchoring at 150 guests and scaling sub-linearly reflects how halls and decor
 * actually price: a hall for 300 costs more than one for 150, but not double.
 */
const BENCHMARK_ANCHOR_GUESTS = 150;

function scaleForSize(range: CostRange, guestCount: number): CostRange {
  const ratio = guestCount / BENCHMARK_ANCHOR_GUESTS;
  // Square root: doubling the guests raises the flat cost by about 40%.
  const factor = Math.sqrt(Math.max(ratio, 0.25));
  return {
    low: Math.round(range.low * factor),
    typical: Math.round(range.typical * factor),
    high: Math.round(range.high * factor),
  };
}

/** The benchmark for a category at this scale, in total rupees. */
export function benchmarkFor(
  category: CostCategory,
  guestCount: number,
  cityTier: CityTier,
): CostRange {
  const base = category.benchmarks[cityTier];

  switch (category.basis) {
    case "per-guest":
      return {
        low: base.low * guestCount,
        typical: base.typical * guestCount,
        high: base.high * guestCount,
      };
    case "flat-by-size":
      return scaleForSize(base, guestCount);
    case "flat":
      return { ...base };
  }
}

function verdictFor(allocated: Money, benchmark: CostRange): BudgetVerdict {
  if (allocated < benchmark.low * UNREALISTIC_FRACTION) return "unrealistic";
  if (allocated < benchmark.low) return "tight";
  if (allocated > benchmark.high) return "generous";
  return "realistic";
}

function noteFor(
  category: CostCategory,
  allocated: Money,
  benchmark: CostRange,
  verdict: BudgetVerdict,
  guestCount: number,
): string {
  // For per-guest categories the per-head figure is the number a planner can
  // actually act on, so it leads.
  const perGuest = category.basis === "per-guest" ? Math.round(allocated / guestCount) : undefined;
  const unit = perGuest !== undefined ? ` (${formatMoney(perGuest)} per guest)` : "";

  switch (verdict) {
    case "unrealistic":
      return (
        `${formatMoney(allocated)}${unit} is below what this is deliverable for. ` +
        `Expect at least ${formatMoney(benchmark.low)}` +
        (category.basis === "per-guest"
          ? `, about ${formatMoney(Math.round(benchmark.low / guestCount))} per guest.`
          : ".") +
        (category.optional ? " Consider dropping it rather than underfunding it." : "")
      );
    case "tight":
      return (
        `${formatMoney(allocated)}${unit} is under the usual ${formatMoney(benchmark.low)}–` +
        `${formatMoney(benchmark.high)}. Achievable with a simpler choice, an off-peak ` +
        `date, or fewer guests.`
      );
    case "generous":
      return (
        `${formatMoney(allocated)}${unit} is above the usual ${formatMoney(benchmark.high)}. ` +
        `There is room to move money to a tighter category.`
      );
    case "realistic":
      return (
        `${formatMoney(allocated)}${unit} sits inside the usual ` +
        `${formatMoney(benchmark.low)}–${formatMoney(benchmark.high)} for this city and size.`
      );
  }
}

/**
 * Build the budget.
 *
 * Allocation runs in whole rupees throughout, and the final remainder from
 * rounding is pushed into contingency so the total is exact rather than
 * approximately right.
 */
export function buildBudget(input: PlanInput): BudgetPlan {
  const categories = categoriesFor(input.eventType);
  const guestCount = Math.max(1, Math.round(input.guestCount));
  const total = Math.max(0, Math.round(input.totalBudget));

  const contingency = Math.round(total * CONTINGENCY_SHARE);
  const distributable = total - contingency;

  const priorities = new Set(input.priorities ?? []);
  const weights = categories.map((category) =>
    priorities.has(category.id) ? category.share * (1 + PRIORITY_BOOST) : category.share,
  );
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);

  // Allocate by floor, then hand the rounding remainder to the largest
  // categories. Distributing it rather than dropping it is what keeps the sum
  // exact without any single line being visibly off.
  const raw = weights.map((w) => (distributable * w) / weightTotal);
  const allocations = raw.map((value) => Math.floor(value));
  let remainder = distributable - allocations.reduce((sum, a) => sum + a, 0);

  const byDescendingFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const { index } of byDescendingFraction) {
    if (remainder <= 0) break;
    allocations[index] += 1;
    remainder -= 1;
  }

  const lines: BudgetLine[] = categories.map((category, index) => {
    const allocated = allocations[index]!;
    const benchmark = benchmarkFor(category, guestCount, input.cityTier);
    const verdict = verdictFor(allocated, benchmark);
    return {
      categoryId: category.id,
      label: category.label,
      covers: category.covers,
      allocated,
      benchmark,
      verdict,
      note: noteFor(category, allocated, benchmark, verdict, guestCount),
      optional: category.optional,
    };
  });

  const allocated = lines.reduce((sum, line) => sum + line.allocated, 0) + contingency;

  // The invariant this engine exists to guarantee. A mismatch is a bug in the
  // arithmetic above, not bad input, so it throws rather than degrading.
  if (allocated !== total) {
    throw new Error(
      `Budget allocation does not balance: allocated ${allocated} against a total of ${total}.`,
    );
  }

  const benchmarkTypical = lines.reduce((sum, line) => sum + line.benchmark.typical, 0);

  return {
    total,
    lines,
    contingency,
    allocated,
    benchmarkTypical,
    perGuest: Math.round(total / guestCount),
  };
}

/**
 * Format rupees the way Indian readers expect: lakh and crore, grouped 2-2-3.
 *
 * `en-IN` grouping matters here. A budget shown as ₹1,200,000 instead of
 * ₹12,00,000 is read wrong at a glance by exactly the audience this is for.
 */
export function formatMoney(amount: Money): string {
  const rupees = Math.round(amount);
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} crore`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)} lakh`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * The value `formatMoney` actually puts on screen, which is not always the exact one.
 *
 * `formatMoney(3_096_234)` renders "₹30.96 lakh" -- a reader, and a model
 * narrating the plan, sees 30,96,000. That displayed value is a legitimate
 * quotation of this plan, so output verification has to accept it: flagging a
 * model for repeating a figure the UI itself shows would make the verification
 * panel noise rather than signal. `lib/plan.ts` adds this value alongside the
 * exact one when it builds the allow-list.
 */
export function displayedValue(amount: Money): Money {
  const rupees = Math.round(amount);
  if (rupees >= 10_000_000) {
    return Math.round(Number((rupees / 10_000_000).toFixed(2)) * 10_000_000);
  }
  if (rupees >= 100_000) {
    return Math.round(Number((rupees / 100_000).toFixed(2)) * 100_000);
  }
  return rupees;
}

/** Exact rupee figure with Indian grouping, for tables where precision matters. */
export function formatExact(amount: Money): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
