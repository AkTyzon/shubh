/**
 * Core domain types.
 *
 * One rule governs this file and everything that consumes it: **a number that
 * reaches a user is computed, never generated.**
 *
 * The failure mode of an AI event planner is not a clumsy sentence. It is a
 * confident ₹8,40,000 that does not add up, a caterer booked three weeks after
 * the kitchen needed confirming, a guest list that will not fit the hall. People
 * commit savings and borrowed money against those numbers. So a language model
 * here proposes categories, themes and wording; every rupee, every date and
 * every capacity check is produced by the engines in `lib/` and validated before
 * it is shown.
 *
 * `Money` is rupees as an integer. Floating-point rupees drift under repeated
 * allocation, and "the parts must sum exactly to the whole" is an invariant this
 * project actually enforces — so the arithmetic is integral throughout.
 */

/** Indian rupees, as a whole number. Never a float. */
export type Money = number;

/** ISO date, `YYYY-MM-DD`. Dates are compared as calendar days, not instants. */
export type IsoDate = string;

/**
 * Cost varies more by city tier than by anything else in India — a per-plate
 * rate in Mumbai is three to four times the same menu in a tier-3 town.
 */
export type CityTier = "metro" | "tier1" | "tier2" | "tier3";

export type EventTypeId = "wedding" | "birthday" | "griha-pravesh" | "community";

/** What the user tells us. Everything else is derived from this. */
export interface PlanInput {
  eventType: EventTypeId;
  /** The main event day. Multi-day events schedule their phases around it. */
  eventDate: IsoDate;
  guestCount: number;
  cityTier: CityTier;
  /** Optional free-text city, used only for display and for the model's context. */
  city?: string;
  totalBudget: Money;
  /** Categories the user refuses to compromise on; they get funded first. */
  priorities?: string[];
  /** Date the plan is being made. Injected rather than read from the clock so
   *  every computation is reproducible and testable. */
  today: IsoDate;
}

export interface CostRange {
  low: Money;
  typical: Money;
  high: Money;
}

export type CostBasis =
  /** Cost scales with the number of guests (catering, return gifts, invitations). */
  | "per-guest"
  /** A flat engagement fee regardless of scale (photographer, pandit, DJ). */
  | "flat"
  /** Flat, but stepped by guest count (venue hire by hall size). */
  | "flat-by-size";

export interface CostCategory {
  id: string;
  label: string;
  /** Plain description of what this actually covers, for a first-time planner. */
  covers: string;
  basis: CostBasis;
  /** Share of the total budget this category typically takes, 0-1. Must sum to 1
   *  across all categories of an event type — asserted at module load. */
  share: number;
  /** Benchmark ranges per city tier, in the unit implied by `basis`. */
  benchmarks: Record<CityTier, CostRange>;
  /** True when a category can be dropped entirely without the event failing. */
  optional: boolean;
}

/** One line of the computed budget. */
export interface BudgetLine {
  categoryId: string;
  label: string;
  covers: string;
  /** What the engine allocated. Allocations sum exactly to the total budget. */
  allocated: Money;
  /** What this category typically costs at this scale and city tier. */
  benchmark: CostRange;
  /** How the allocation compares with the benchmark. */
  verdict: BudgetVerdict;
  /** Human-readable explanation of the verdict, with the numbers that drove it. */
  note: string;
  optional: boolean;
}

export type BudgetVerdict =
  /** Allocation sits inside the benchmark range. */
  | "realistic"
  /** Below the benchmark low: achievable only with compromises, which we name. */
  | "tight"
  /** Far below the low: this category cannot be delivered at this price. */
  | "unrealistic"
  /** Above the benchmark high: there is room to move money elsewhere. */
  | "generous";

export interface BudgetPlan {
  total: Money;
  lines: BudgetLine[];
  /** Held back for the things nobody plans for. Part of `total`, not extra. */
  contingency: Money;
  /** Sum of every allocation plus contingency. Asserted to equal `total`. */
  allocated: Money;
  /** Benchmark total at the typical rate, for an at-a-glance reality check. */
  benchmarkTypical: Money;
  perGuest: Money;
}

export type TaskStatus = "overdue" | "due-now" | "upcoming";

export interface TimelineTask {
  id: string;
  label: string;
  /** Why this has to happen when it does — a planner needs the reason, not just
   *  the date, to judge whether they can safely slip it. */
  why: string;
  categoryId?: string;
  /** Days before the event this must be done. Drives the computed date. */
  leadDays: number;
  /** Tasks that must complete first. Validated to be acyclic at load. */
  dependsOn: string[];
  /** Computed: `eventDate - leadDays`, adjusted so dependencies stay ordered. */
  dueDate: IsoDate;
  /** Computed against `today`. */
  status: TaskStatus;
  /** Days from today until due. Negative when overdue. */
  daysFromToday: number;
}

export interface TimelinePlan {
  eventDate: IsoDate;
  tasks: TimelineTask[];
  /** Days between today and the event. */
  daysAvailable: number;
  /** Tasks whose lead time no longer fits before the event. */
  overdue: TimelineTask[];
}

export type IssueSeverity = "blocker" | "warning" | "note";

/**
 * Something the plan cannot deliver as stated.
 *
 * Surfaced rather than silently absorbed: a planner who is told "your date needs
 * 180 days of venue lead time and you have 54" can change the date. One handed a
 * tidy schedule that quietly assumes the impossible cannot.
 */
export interface FeasibilityIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  /** The specific numbers that produced this finding. */
  detail: string;
  /** What the planner can actually do about it. */
  options: string[];
}

export interface Plan {
  input: PlanInput;
  budget: BudgetPlan;
  timeline: TimelinePlan;
  issues: FeasibilityIssue[];
  /** Every rupee figure this plan legitimately contains, for output verification. */
  verifiedFigures: Money[];
}
