import type { FeasibilityIssue } from "@/lib/types";
import { SeverityBadge } from "./Verdict";

/**
 * What the plan cannot deliver.
 *
 * This panel is the reason to use this rather than ask a chatbot, and it is
 * placed above the budget deliberately. An assistant that produces a cheerful
 * plan for an event that cannot happen is worse than one that produces nothing,
 * because the planner proceeds on it.
 *
 * Every issue states the numbers that produced it and what can actually be done.
 * "Your budget is unrealistic" is not useful. "₹3 lakh across 400 guests is ₹750
 * a head against a typical ₹30.96 lakh — reduce to roughly 80 guests, or move to
 * a lower city tier" is a decision the planner can make.
 *
 * None of this text comes from a model. It is derived from the computed budget
 * and schedule, which is why it can be trusted to be arithmetically true about
 * this specific plan.
 */
export function FeasibilityPanel({ issues }: { issues: FeasibilityIssue[] }) {
  if (issues.length === 0) {
    return (
      <section
        aria-labelledby="feasibility-heading"
        className="rounded-xl border border-[var(--color-good)] bg-[var(--color-good-soft)] p-4"
      >
        <h2
          id="feasibility-heading"
          className="font-serif text-lg font-semibold text-[var(--color-good)]"
        >
          <span aria-hidden="true">✓ </span>
          Nothing blocking
        </h2>
        <p className="mt-1 text-sm text-[var(--text)]">
          The budget covers this event at this size, and every task still has enough lead time
          before the date. The checks that were run are listed in the methodology below.
        </p>
      </section>
    );
  }

  const blockers = issues.filter((issue) => issue.severity === "blocker");

  return (
    <section aria-labelledby="feasibility-heading" className="grid gap-3">
      <div>
        <h2 id="feasibility-heading" className="font-serif text-2xl font-semibold">
          {blockers.length > 0 ? "This plan does not work yet" : "Things to deal with"}
        </h2>
        <p className="mt-1 text-[var(--text-soft)]">
          {blockers.length > 0
            ? `${blockers.length} ${blockers.length === 1 ? "finding stops" : "findings stop"} this plan as entered. ` +
              `Every figure below was computed from your budget and date, not estimated.`
            : "None of these stops the plan. All of them cost money or goodwill if ignored."}
        </p>
      </div>

      <ul className="grid gap-3">
        {issues.map((issue) => (
          <li
            key={issue.id}
            className={`avoid-break rounded-xl border p-4 ${
              issue.severity === "blocker"
                ? "border-[var(--color-bad)] bg-[var(--color-bad-soft)]"
                : issue.severity === "warning"
                  ? "border-[var(--color-warn)] bg-[var(--color-warn-soft)]"
                  : "bg-[var(--surface-raised)]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">{issue.title}</h3>
              <SeverityBadge severity={issue.severity} />
            </div>
            <p className="mt-1.5 text-sm">{issue.detail}</p>
            {issue.options.length > 0 && (
              <>
                <h4 className="mt-3 text-xs font-semibold tracking-wide uppercase text-[var(--text-soft)]">
                  What you can do
                </h4>
                <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm">
                  {issue.options.map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
