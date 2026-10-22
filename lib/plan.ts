/**
 * Plan assembly and input validation.
 *
 * One entry point: `buildPlan` takes what the user typed and returns a fully
 * computed plan. No language model is involved at any point, which is why the
 * product works with no API key configured and why the same input always
 * produces the same plan.
 *
 * `verifiedFigures` is collected here. It is the set of every rupee amount the
 * plan legitimately contains, and it is what `lib/verify.ts` later checks model
 * output against. A figure the model states that is not in this set was invented
 * by the model, and the reader is told so.
 */

import { buildBudget, displayedValue } from "./budget";
import { findIssues } from "./feasibility";
import { COST_CATEGORIES } from "./knowledge/costs";
import { buildTimeline, daysBetween, parseDate } from "./timeline";
import { extractFigures } from "./verify";
import type {
  BudgetPlan,
  CityTier,
  EventTypeId,
  FeasibilityIssue,
  Money,
  Plan,
  PlanInput,
} from "./types";

export const EVENT_TYPES: { id: EventTypeId; label: string; blurb: string }[] = [
  {
    id: "wedding",
    label: "Wedding",
    blurb: "Multi-day celebration: engagement, haldi, mehendi, sangeet, ceremony, reception.",
  },
  {
    id: "birthday",
    label: "Birthday",
    blurb: "A child's party or a milestone birthday, at home or at a venue.",
  },
  {
    id: "griha-pravesh",
    label: "Griha Pravesh",
    blurb: "Housewarming puja with family and neighbours.",
  },
  {
    id: "community",
    label: "Community event",
    blurb: "Society function, festival programme or neighbourhood celebration.",
  },
];

const CITY_TIER_IDS: CityTier[] = ["metro", "tier1", "tier2", "tier3"];

/** Guard rails. Generous at both ends, but a plan outside them is not a plan. */
export const LIMITS = {
  minGuests: 2,
  maxGuests: 5_000,
  minBudget: 1_000,
  maxBudget: 500_000_000,
  /** Furthest ahead a plan is meaningful; benchmarks drift beyond this. */
  maxDaysAhead: 1_825,
} as const;

export class PlanInputError extends Error {
  constructor(
    message: string,
    /** Which field to put the error against in the form. */
    readonly field: string,
  ) {
    super(message);
    this.name = "PlanInputError";
  }
}

/**
 * Validate and normalise raw input.
 *
 * Errors name the field and say what would be acceptable, because an error
 * message that only says "invalid" leaves the user guessing at the fix.
 */
export function parsePlanInput(raw: unknown): PlanInput {
  if (typeof raw !== "object" || raw === null) {
    throw new PlanInputError("Expected a plan object.", "form");
  }
  const body = raw as Record<string, unknown>;

  const eventType = String(body.eventType ?? "") as EventTypeId;
  if (!EVENT_TYPES.some((e) => e.id === eventType)) {
    throw new PlanInputError("Choose the kind of event you are planning.", "eventType");
  }

  const cityTier = String(body.cityTier ?? "") as CityTier;
  if (!CITY_TIER_IDS.includes(cityTier)) {
    throw new PlanInputError("Choose a city tier.", "cityTier");
  }

  const guestCount = Math.round(Number(body.guestCount));
  if (!Number.isFinite(guestCount) || guestCount < LIMITS.minGuests || guestCount > LIMITS.maxGuests) {
    throw new PlanInputError(
      `Guest count must be between ${LIMITS.minGuests} and ${LIMITS.maxGuests}.`,
      "guestCount",
    );
  }

  const totalBudget = Math.round(Number(body.totalBudget));
  if (!Number.isFinite(totalBudget) || totalBudget < LIMITS.minBudget || totalBudget > LIMITS.maxBudget) {
    throw new PlanInputError(
      `Budget must be between ₹${LIMITS.minBudget.toLocaleString("en-IN")} and ` +
        `₹${LIMITS.maxBudget.toLocaleString("en-IN")}.`,
      "totalBudget",
    );
  }

  const eventDate = String(body.eventDate ?? "");
  try {
    parseDate(eventDate);
  } catch {
    throw new PlanInputError("Enter the event date as a valid calendar date.", "eventDate");
  }

  // `today` is supplied by the caller rather than read from the clock, so a plan
  // is reproducible and every date assertion in the tests is stable.
  const today = String(body.today ?? "") || new Date().toISOString().slice(0, 10);
  try {
    parseDate(today);
  } catch {
    throw new PlanInputError("Invalid reference date.", "today");
  }

  const ahead = daysBetween(today, eventDate);
  if (ahead > LIMITS.maxDaysAhead) {
    throw new PlanInputError(
      `That date is more than ${Math.round(LIMITS.maxDaysAhead / 365)} years away. ` +
        `Cost benchmarks would not be meaningful that far ahead.`,
      "eventDate",
    );
  }

  const validCategoryIds = new Set(COST_CATEGORIES[eventType].map((c) => c.id));
  const priorities = Array.isArray(body.priorities)
    ? body.priorities.map(String).filter((id) => validCategoryIds.has(id))
    : [];

  const city = typeof body.city === "string" ? body.city.trim().slice(0, 60) : undefined;

  return { eventType, eventDate, guestCount, cityTier, city, totalBudget, priorities, today };
}

/** Build the complete plan. Deterministic: same input, same output, always. */
export function buildPlan(input: PlanInput): Plan {
  const budget = buildBudget(input);
  const timeline = buildTimeline(input);
  const issues = findIssues(input, budget, timeline);

  return { input, budget, timeline, issues, verifiedFigures: collectFigures(budget, issues) };
}

/**
 * Every rupee figure the plan legitimately contains.
 *
 * This is the allow-list `lib/verify.ts` checks model output against. The
 * definition that matters is **anything this product itself puts on screen**: if
 * the plan shows a number, a faithful narration may quote it, and flagging the
 * reader for repeating what they were shown would make the verification panel
 * worse than useless.
 *
 * So it is collected from three places, not one:
 *
 * 1. The structural figures -- total, contingency, per-guest, allocations and
 *    benchmark bounds.
 * 2. The lakh/crore form each of those is *displayed* as. "₹30.96 lakh" is what
 *    the reader sees for ₹30,96,234.
 * 3. The figures inside the budget notes and the feasibility findings, extracted
 *    with the same extractor the verifier uses. These are genuinely derived
 *    numbers -- a shortfall, a per-plate rate -- computed in code and shown to
 *    the user, and they were a real omission: without them, a model repeating
 *    "₹750 a head" from the feasibility panel was reported as having invented it.
 *
 * Sharing the extractor with the verifier is what keeps (3) honest. A second
 * implementation would drift, and the drift would show up as the product
 * flagging its own arithmetic.
 */
function collectFigures(budget: BudgetPlan, issues: FeasibilityIssue[]): Money[] {
  const figures = new Set<Money>();

  // Each figure is added twice: the exact rupee value, and the value its
  // lakh/crore display form conveys. The plan shows "₹30.96 lakh" for
  // ₹30,96,234, so a model quoting the screen back is quoting the plan
  // correctly and must not be flagged for it. See `displayedValue`.
  const add = (amount: Money) => {
    figures.add(amount);
    figures.add(displayedValue(amount));
  };

  add(budget.total);
  add(budget.contingency);
  add(budget.allocated);
  add(budget.benchmarkTypical);
  add(budget.perGuest);

  for (const line of budget.lines) {
    add(line.allocated);
    add(line.benchmark.low);
    add(line.benchmark.typical);
    add(line.benchmark.high);
  }

  // Figures the product derives and displays in prose: per-guest rates in the
  // budget notes, shortfalls and per-plate rates in the findings.
  const prose = [
    ...budget.lines.map((line) => line.note),
    ...issues.flatMap((issue) => [issue.title, issue.detail, ...issue.options]),
  ].join("\n");
  for (const { value } of extractFigures(prose)) add(value);

  return [...figures].sort((a, b) => a - b);
}

/**
 * A compact, text-only rendering of the plan for the model to narrate.
 *
 * Deliberately exhaustive about numbers and silent about prose: the model is
 * being asked to explain and personalise a plan that already exists, not to
 * invent one. Everything it could legitimately cite is here, so anything else it
 * produces is detectable as invented.
 */
export function planAsContext(plan: Plan): string {
  const { input, budget, timeline, issues } = plan;
  const lines = [
    `EVENT: ${input.eventType}`,
    `DATE: ${input.eventDate} (${timeline.daysAvailable} days away)`,
    `GUESTS: ${input.guestCount}`,
    `LOCATION TIER: ${input.cityTier}${input.city ? ` (${input.city})` : ""}`,
    `TOTAL BUDGET: ₹${budget.total}`,
    `CONTINGENCY HELD BACK: ₹${budget.contingency}`,
    `TYPICAL MARKET TOTAL AT THIS SIZE: ₹${budget.benchmarkTypical}`,
    "",
    "COMPUTED ALLOCATIONS (these are the only budget figures that exist):",
    ...budget.lines.map(
      (line) =>
        `- ${line.label}: ₹${line.allocated} [${line.verdict}] ` +
        `(market ₹${line.benchmark.low}–₹${line.benchmark.high})`,
    ),
    "",
    "COMPUTED SCHEDULE (these are the only dates that exist):",
    ...timeline.tasks.map((task) => `- ${task.dueDate}: ${task.label} [${task.status}]`),
  ];

  if (issues.length > 0) {
    lines.push("", "ISSUES THE ENGINE FOUND:");
    for (const issue of issues) lines.push(`- [${issue.severity}] ${issue.title}: ${issue.detail}`);
  }

  return lines.join("\n");
}
