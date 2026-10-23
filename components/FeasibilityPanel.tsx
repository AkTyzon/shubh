import type { FeasibilityIssue } from "@/lib/types";
import { SeverityBadge } from "./Verdict";

/**
 * What the plan cannot deliver.
 *
 * Placed above the budget deliberately. An assistant that produces a cheerful
 * plan for an event that cannot happen is worse than one that produces nothing,
 * because the planner proceeds on it.
 *
 * Every issue states the numbers that produced it and what can actually be done.
 * "Your budget is unrealistic" helps nobody; "₹3 lakh across 400 guests is ₹750 a
 * head against a typical ₹30.96 lakh — reduce to roughly 80 guests, or move to a
 * lower city tier" is a decision someone can make.
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
        className="avoid-break rounded-[var(--radius)] border p-5"
        style={{ borderColor: "var(--good)", background: "var(--good-soft)" }}
      >
        <h2
          id="feasibility-heading"
          className="flex items-center gap-2 text-xl font-semibold"
          style={{ color: "var(--good)" }}
        >
          <span aria-hidden="true">✓</span>
          Nothing blocking this plan
        </h2>
        <p className="mt-1.5 text-sm text-[var(--text)]">
          The budget covers this event at this size, and every task still has enough lead time
          before the date. The checks that ran are listed in the methodology at the bottom.
        </p>
      </section>
    );
  }

  const blockers = issues.filter((issue) => issue.severity === "blocker");

  return (
    <section aria-labelledby="feasibility-heading" className="grid gap-4">
      <header>
        <h2 id="feasibility-heading" className="text-2xl font-semibold sm:text-3xl">
          {blockers.length > 0 ? "This plan does not work yet" : "Things to deal with"}
        </h2>
        <p className="mt-1.5 max-w-2xl text-[var(--text-soft)]">
          {blockers.length > 0
            ? `${blockers.length} ${blockers.length === 1 ? "finding stops" : "findings stop"} this plan as entered. ` +
              `Every figure below was computed from your budget and date, not estimated.`
            : "None of these stops the plan. All of them cost money or goodwill if ignored."}
        </p>
      </header>

      <ul className="grid gap-3">
        {issues.map((issue) => (
          <li
            key={issue.id}
            className="avoid-break rounded-[var(--radius)] border p-4 sm:p-5"
            style={
              issue.severity === "blocker"
                ? { borderColor: "var(--bad)", background: "var(--bad-soft)" }
                : issue.severity === "warning"
                  ? { borderColor: "var(--warn)", background: "var(--warn-soft)" }
                  : { background: "var(--surface-raised)" }
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{issue.title}</h3>
              <SeverityBadge severity={issue.severity} />
            </div>
            <p className="mt-1.5 text-sm">{issue.detail}</p>

            {issue.options.length > 0 && (
              <>
                <h4 className="mt-3.5 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
                  What you can do
                </h4>
                <ul className="mt-1.5 grid gap-1.5 text-sm">
                  {issue.options.map((option) => (
                    <li key={option} className="flex gap-2">
                      <span aria-hidden="true" className="text-[var(--accent)]">
                        →
                      </span>
                      {option}
                    </li>
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
