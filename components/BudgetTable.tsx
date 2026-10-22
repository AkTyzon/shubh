import { formatExact, formatMoney } from "@/lib/budget";
import type { BudgetPlan, PlanInput } from "@/lib/types";
import { VerdictBadge } from "./Verdict";

/**
 * The computed budget.
 *
 * A real `<table>` with a `<caption>`, scoped headers and a `<tfoot>` carrying
 * the total — not a grid of divs. A screen reader reading a div grid gets a list
 * of unrelated numbers; reading this it gets "Catering, allocated six lakh
 * seventy-five thousand, verdict realistic", which is the sentence that matters.
 *
 * On narrow screens the same data is rendered as cards instead, because a
 * five-column financial table on a 360px phone is either unreadable or requires
 * horizontal scrolling, and most of this audience is on a phone.
 *
 * The footer states the arithmetic identity out loud. "Allocations + contingency
 * = your budget, exactly" is the claim this whole project rests on, and showing
 * the three numbers together is how a reader checks it rather than trusting it.
 */
export function BudgetTable({ budget, input }: { budget: BudgetPlan; input: PlanInput }) {
  const lineTotal = budget.lines.reduce((sum, line) => sum + line.allocated, 0);

  return (
    <section aria-labelledby="budget-heading" className="grid gap-4">
      <div>
        <h2 id="budget-heading" className="font-serif text-2xl font-semibold">
          Where the money goes
        </h2>
        <p className="mt-1 text-[var(--text-soft)]">
          Allocated from your {formatMoney(budget.total)} by category share, then scored against
          what each category actually costs for {input.guestCount}{" "}
          {input.guestCount === 1 ? "guest" : "guests"} in a {tierWord(input.cityTier)} location.
        </p>
      </div>

      {/* Desktop and tablet: the table. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Budget allocation by category, with the market range and a verdict for each.
            Allocations plus contingency sum exactly to the total budget.
          </caption>
          <thead>
            <tr className="border-b-2 border-[var(--border-strong)] text-left">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Category
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Allocated
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Usual range here
              </th>
              <th scope="col" className="py-2 font-semibold">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((line) => (
              <tr key={line.categoryId} className="avoid-break border-b align-top">
                <th scope="row" className="py-3 pr-3 text-left font-semibold">
                  {line.label}
                  {line.optional && (
                    <span className="ml-2 rounded border px-1.5 py-0.5 text-xs font-normal text-[var(--text-soft)]">
                      optional
                    </span>
                  )}
                  <span className="mt-1 block text-xs font-normal text-[var(--text-soft)]">
                    {line.covers}
                  </span>
                </th>
                <td className="nums py-3 pr-3 text-right font-semibold whitespace-nowrap">
                  {formatExact(line.allocated)}
                </td>
                <td className="nums py-3 pr-3 text-right whitespace-nowrap text-[var(--text-soft)]">
                  {formatMoney(line.benchmark.low)} – {formatMoney(line.benchmark.high)}
                </td>
                <td className="py-3">
                  <VerdictBadge verdict={line.verdict} />
                  <span className="mt-1.5 block max-w-xs text-xs text-[var(--text-soft)]">
                    {line.note}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-b">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                Contingency held back
                <span className="mt-0.5 block text-xs text-[var(--text-soft)]">
                  Inside your budget, not added to it.
                </span>
              </th>
              <td className="nums py-2 pr-3 text-right font-semibold whitespace-nowrap">
                {formatExact(budget.contingency)}
              </td>
              <td colSpan={2} />
            </tr>
            <tr className="border-t-2 border-[var(--border-strong)]">
              <th scope="row" className="py-3 pr-3 text-left font-semibold">
                Total
              </th>
              <td className="nums py-3 pr-3 text-right text-base font-bold whitespace-nowrap">
                {formatExact(budget.allocated)}
              </td>
              <td colSpan={2} className="py-3 text-xs text-[var(--text-soft)]">
                {formatExact(lineTotal)} allocated + {formatExact(budget.contingency)} contingency ={" "}
                {formatExact(budget.allocated)}. Exact, to the rupee.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phone: the same data as cards. */}
      <ul className="grid gap-3 md:hidden">
        {budget.lines.map((line) => (
          <li key={line.categoryId} className="avoid-break rounded-lg border bg-[var(--surface-raised)] p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">
                {line.label}
                {line.optional && (
                  <span className="ml-2 rounded border px-1.5 py-0.5 text-xs font-normal text-[var(--text-soft)]">
                    optional
                  </span>
                )}
              </h3>
              <span className="nums font-semibold whitespace-nowrap">
                {formatExact(line.allocated)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-soft)]">{line.covers}</p>
            <div className="mt-2">
              <VerdictBadge verdict={line.verdict} />
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-soft)]">{line.note}</p>
          </li>
        ))}
        <li className="avoid-break rounded-lg border bg-[var(--surface-sunken)] p-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">Contingency held back</h3>
            <span className="nums font-semibold whitespace-nowrap">
              {formatExact(budget.contingency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-soft)]">
            Inside your budget, not added to it.
          </p>
        </li>
        <li className="rounded-lg border-2 border-[var(--border-strong)] p-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold">Total</h3>
            <span className="nums text-base font-bold whitespace-nowrap">
              {formatExact(budget.allocated)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-soft)]">
            {formatExact(lineTotal)} allocated + {formatExact(budget.contingency)} contingency.
            Exact, to the rupee.
          </p>
        </li>
      </ul>
    </section>
  );
}

function tierWord(tier: PlanInput["cityTier"]): string {
  switch (tier) {
    case "metro":
      return "metro";
    case "tier1":
      return "tier-1";
    case "tier2":
      return "tier-2";
    case "tier3":
      return "tier-3";
  }
}
