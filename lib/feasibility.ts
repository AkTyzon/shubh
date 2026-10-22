/**
 * Feasibility checks.
 *
 * The part of the product that is willing to say no.
 *
 * A planning assistant that always produces a cheerful plan is worse than
 * useless when the plan cannot happen: a ₹3 lakh wedding for 400 guests in
 * Mumbai, or a date seven weeks away when the venue alone needs six months of
 * notice. The failure is not that the model is wrong about any one line — it is
 * that nobody adds the lines up and checks them against the calendar.
 *
 * Every issue here is derived from the computed budget and schedule, never
 * generated, and every one states the numbers that produced it and what the
 * planner can actually do. "Your budget is unrealistic" helps nobody; "₹3 lakh
 * across 400 guests is ₹750 a head, and catering alone starts near ₹1,200 in a
 * metro — 150 fewer guests or a tier-2 venue closes the gap" is a decision.
 */

import { benchmarkFor, formatMoney } from "./budget";
import { categoriesFor } from "./knowledge/costs";
import { minimumNoticeDays } from "./knowledge/timelines";
import { displayDate } from "./timeline";
import type { BudgetPlan, FeasibilityIssue, PlanInput, TimelinePlan } from "./types";

/**
 * Below this fraction of the typical benchmark total, the plan is not tight --
 * it is a different event. Set at 65% so genuinely frugal but achievable plans
 * are not called impossible.
 */
const BUDGET_BLOCKER_FRACTION = 0.65;
const BUDGET_WARNING_FRACTION = 0.85;

/** Guest counts above this need logistics a generic plan does not cover. */
const LARGE_EVENT_GUESTS = 500;

export function findIssues(
  input: PlanInput,
  budget: BudgetPlan,
  timeline: TimelinePlan,
): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [
    ...budgetIssues(input, budget),
    ...timingIssues(input, timeline),
    ...scaleIssues(input, budget),
  ];

  // Blockers first: a planner should see what stops the plan before what merely
  // complicates it.
  const order = { blocker: 0, warning: 1, note: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

function budgetIssues(input: PlanInput, budget: BudgetPlan): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  const ratio = budget.total / budget.benchmarkTypical;
  const perGuest = budget.perGuest;

  if (ratio < BUDGET_BLOCKER_FRACTION) {
    const shortfall = budget.benchmarkTypical - budget.total;
    // The guest count that the stated budget would actually cover.
    const affordableGuests = Math.max(
      10,
      Math.floor(input.guestCount * Math.max(ratio, 0.2)),
    );
    issues.push({
      id: "budget-insufficient",
      severity: "blocker",
      title: "This budget will not cover this event at this size",
      detail:
        `${formatMoney(budget.total)} across ${input.guestCount} guests is ` +
        `${formatMoney(perGuest)} a head. A typical ${label(input)} at this size and ` +
        `location runs near ${formatMoney(budget.benchmarkTypical)} — a gap of about ` +
        `${formatMoney(shortfall)}.`,
      options: [
        `Reduce to roughly ${affordableGuests} guests, which this budget does cover.`,
        "Move to a lower-cost city tier or an out-of-season date.",
        `Raise the budget to about ${formatMoney(budget.benchmarkTypical)}.`,
        "Drop the optional categories below and put everything into food and venue.",
      ],
    });
  } else if (ratio < BUDGET_WARNING_FRACTION) {
    issues.push({
      id: "budget-tight",
      severity: "warning",
      title: "The budget is tight but workable",
      detail:
        `${formatMoney(budget.total)} is about ${Math.round(ratio * 100)}% of the typical ` +
        `${formatMoney(budget.benchmarkTypical)} for this size and location. It can be done ` +
        `with deliberate choices rather than default ones.`,
      options: [
        "Book out of season, or on a weekday, where venues discount heavily.",
        "Trim the guest list — it is the only lever that moves catering and venue together.",
        "Keep the contingency intact; a tight budget is exactly when it gets used.",
      ],
    });
  }

  // Any single category that simply cannot be delivered at its allocation.
  const unrealistic = budget.lines.filter((line) => line.verdict === "unrealistic");
  if (unrealistic.length > 0 && ratio >= BUDGET_BLOCKER_FRACTION) {
    issues.push({
      id: "categories-underfunded",
      severity: "warning",
      title: `${unrealistic.length} ${unrealistic.length === 1 ? "category is" : "categories are"} underfunded`,
      detail: unrealistic
        .map((line) => `${line.label}: ${formatMoney(line.allocated)} against a floor of ${formatMoney(line.benchmark.low)}`)
        .join("; ") + ".",
      options: [
        "Move money from any category marked generous.",
        ...unrealistic.filter((l) => l.optional).map((l) => `Drop ${l.label.toLowerCase()} rather than underfund it.`),
      ],
    });
  }

  return issues;
}

function timingIssues(input: PlanInput, timeline: TimelinePlan): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  const { daysAvailable } = timeline;

  if (daysAvailable < 0) {
    issues.push({
      id: "date-past",
      severity: "blocker",
      title: "The event date has already passed",
      detail: `${displayDate(input.eventDate)} is ${Math.abs(daysAvailable)} days ago.`,
      options: ["Pick a future date."],
    });
    return issues;
  }

  const notice = minimumNoticeDays(input.eventType);

  if (timeline.overdue.length > 0) {
    const worst = timeline.overdue.reduce((a, b) => (a.daysFromToday < b.daysFromToday ? a : b));
    issues.push({
      id: "timeline-compressed",
      severity: daysAvailable < notice / 3 ? "blocker" : "warning",
      title: `${timeline.overdue.length} ${timeline.overdue.length === 1 ? "task is" : "tasks are"} already past their ideal date`,
      detail:
        `There are ${daysAvailable} days until ${displayDate(input.eventDate)}. A ${label(input)} ` +
        `is usually planned over about ${notice} days. The most pressing is "${worst.label}", ` +
        `which would normally be done ${Math.abs(worst.daysFromToday)} days ago.`,
      options: [
        "Start with the overdue items today, in the order shown.",
        "Ask vendors directly about availability before assuming the date is lost.",
        daysAvailable < notice / 3
          ? "Consider a later date — this one leaves very little room."
          : "Expect to pay more for short notice, especially venue and catering.",
      ],
    });
  }

  if (daysAvailable > 0 && daysAvailable < 14 && input.eventType === "wedding") {
    issues.push({
      id: "wedding-very-short-notice",
      severity: "blocker",
      title: "Under two weeks is not enough for a wedding of this kind",
      detail:
        `${daysAvailable} days is below what venue, catering and priest booking need even at ` +
        `short notice. A court marriage or a small home ceremony is achievable; a full function ` +
        `at this scale is not.`,
      options: [
        "Hold a small ceremony now and the reception at a later date.",
        "Move the date out by at least two to three months.",
      ],
    });
  }

  return issues;
}

function scaleIssues(input: PlanInput, budget: BudgetPlan): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];

  if (input.guestCount > LARGE_EVENT_GUESTS) {
    issues.push({
      id: "large-event",
      severity: "note",
      title: `${input.guestCount} guests needs logistics this plan does not cover`,
      detail:
        "Above roughly 500 guests, parking, crowd flow, toilets, queue management at the " +
        "buffet and power backup stop being details and become the plan.",
      options: [
        "Walk the venue specifically for parking and entry flow.",
        "Ask the caterer how many service counters they will run — one queue for 500 people does not work.",
        "Confirm generator backup in writing.",
      ],
    });
  }

  // Catering is the line most people underestimate, so it gets a dedicated check.
  const catering = budget.lines.find((line) => line.categoryId === "catering");
  if (catering) {
    const category = categoriesFor(input.eventType).find((c) => c.id === "catering");
    if (category && category.basis === "per-guest") {
      const perPlate = Math.round(catering.allocated / Math.max(1, input.guestCount));
      const benchmark = benchmarkFor(category, 1, input.cityTier);
      if (perPlate < benchmark.low) {
        issues.push({
          id: "per-plate-low",
          severity: "warning",
          title: "The per-plate rate is below the local market",
          detail:
            `This budget gives ${formatMoney(perPlate)} per plate. Caterers here typically ` +
            `start around ${formatMoney(benchmark.low)} for a simple menu.`,
          options: [
            "Ask for a fixed per-plate quote in writing before committing to a guest count.",
            "A smaller guest list at a better menu usually reads better than the reverse.",
          ],
        });
      }
    }
  }

  return issues;
}

function label(input: PlanInput): string {
  switch (input.eventType) {
    case "wedding":
      return "wedding";
    case "birthday":
      return "birthday party";
    case "griha-pravesh":
      return "griha pravesh";
    case "community":
      return "community event";
  }
}
