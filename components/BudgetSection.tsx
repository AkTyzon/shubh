import { formatExact, formatMoney } from "@/lib/budget";
import { CONTINGENCY_FILL, rampColour, type Occasion } from "@/lib/theme";
import type { BudgetPlan, PlanInput } from "@/lib/types";
import { VerdictBadge } from "./Verdict";

/**
 * Where the money goes.
 *
 * Two renderings of one set of numbers, deliberately:
 *
 * - **A proportional bar**, so the shape of the budget is readable in a glance.
 *   It is `aria-hidden` and carries no figures.
 * - **A real table** — `<caption>`, `<thead>`, `scope` on every header, a
 *   `<tfoot>` with the total — which is the accessible source of the same data.
 *   A screen reader on a grid of divs gets a list of unrelated numbers; on this
 *   it gets "Catering, allocated six lakh seventy-five thousand, verdict
 *   realistic".
 *
 * That split is the honest one. Encoding ten categories in colour alone and
 * calling it accessible because the swatches have labels would not be.
 *
 * On a phone the table becomes cards, because a five-column financial table at
 * 360px either is unreadable or needs horizontal scrolling — and `display: none`
 * means only one of the two is ever in the accessibility tree.
 *
 * The footer states the arithmetic out loud. "Allocations + contingency = your
 * budget, exactly" is the claim this whole project rests on, and showing the
 * three numbers together is how a reader checks it instead of trusting it.
 */
export function BudgetSection({
  budget,
  input,
  occasion,
}: {
  budget: BudgetPlan;
  input: PlanInput;
  occasion: Occasion;
}) {
  const lineTotal = budget.lines.reduce((sum, line) => sum + line.allocated, 0);
  const total = Math.max(1, budget.total);

  const fills = budget.lines.map((_, index) =>
    rampColour(occasion, index, budget.lines.length),
  );

  return (
    <section aria-labelledby="budget-heading" className="grid gap-5">
      <header>
        <h2 id="budget-heading" className="text-2xl font-semibold sm:text-3xl">
          Where the money goes
        </h2>
        <p className="mt-1.5 max-w-2xl text-[var(--text-soft)]">
          Your {formatMoney(budget.total)} split by category, then each line scored against what
          it actually costs for {input.guestCount} {input.guestCount === 1 ? "guest" : "guests"} in
          a {tierWord(input.cityTier)} location.
        </p>
      </header>

      {/* The shape of the budget, at a glance. Figures live in the table. */}
      <div className="card avoid-break p-4 sm:p-5">
        <div className="bar" aria-hidden="true">
          {budget.lines.map((line, index) => (
            <div
              key={line.categoryId}
              className="bar-segment"
              style={{
                width: `${(line.allocated / total) * 100}%`,
                background: fills[index],
              }}
              title={`${line.label}: ${formatExact(line.allocated)}`}
            />
          ))}
          <div
            className="bar-segment"
            style={{ width: `${(budget.contingency / total) * 100}%`, background: CONTINGENCY_FILL }}
            title={`Contingency: ${formatExact(budget.contingency)}`}
          />
        </div>

        <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {budget.lines.map((line, index) => (
            <li key={line.categoryId} className="flex items-center gap-1.5">
              <span className="swatch" style={{ background: fills[index] }} />
              <span className="text-[var(--text-soft)]">{line.label}</span>
              <span className="nums font-semibold">
                {Math.round((line.allocated / total) * 100)}%
              </span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="swatch" style={{ background: CONTINGENCY_FILL }} />
            <span className="text-[var(--text-soft)]">Contingency</span>
            <span className="nums font-semibold">
              {Math.round((budget.contingency / total) * 100)}%
            </span>
          </li>
        </ul>
      </div>

      {/* Desktop and tablet: the table. */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Budget allocation by category, with the market range and a verdict for each.
            Allocations plus contingency sum exactly to the total budget.
          </caption>
          <thead>
            <tr className="border-b bg-[var(--surface-sunken)] text-left">
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Category
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Allocated
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Usual range here
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((line, index) => (
              <tr key={line.categoryId} className="avoid-break border-b align-top last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="swatch" aria-hidden="true" style={{ background: fills[index] }} />
                    {line.label}
                    {line.optional && (
                      <span className="pill border-[var(--border-strong)] text-[var(--text-soft)]">
                        optional
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs font-normal text-[var(--text-soft)]">
                    {line.covers}
                  </span>
                </th>
                <td className="nums px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {formatExact(line.allocated)}
                </td>
                <td className="nums px-4 py-3 text-right whitespace-nowrap text-[var(--text-soft)]">
                  {formatMoney(line.benchmark.low)} – {formatMoney(line.benchmark.high)}
                </td>
                <td className="px-4 py-3">
                  <VerdictBadge verdict={line.verdict} />
                  <span className="mt-1.5 block max-w-xs text-xs text-[var(--text-soft)]">
                    {line.note}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[var(--surface-sunken)]">
            <tr className="border-t">
              <th scope="row" className="px-4 py-2.5 text-left font-normal">
                <span className="flex items-center gap-2">
                  <span className="swatch" aria-hidden="true" style={{ background: CONTINGENCY_FILL }} />
                  Contingency held back
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-soft)]">
                  Inside your budget, not added to it.
                </span>
              </th>
              <td className="nums px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                {formatExact(budget.contingency)}
              </td>
              <td colSpan={2} />
            </tr>
            <tr className="border-t-2 border-[var(--border-strong)]">
              <th scope="row" className="px-4 py-3 text-left text-base font-semibold">
                Total
              </th>
              <td className="nums px-4 py-3 text-right text-base font-bold whitespace-nowrap">
                {formatExact(budget.allocated)}
              </td>
              <td colSpan={2} className="px-4 py-3 text-xs text-[var(--text-soft)]">
                {formatExact(lineTotal)} allocated + {formatExact(budget.contingency)} contingency ={" "}
                <strong className="text-[var(--text)]">{formatExact(budget.allocated)}</strong>.
                Exact, to the rupee.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phone: the same data as cards. */}
      <ul className="grid gap-3 md:hidden">
        {budget.lines.map((line, index) => (
          <li key={line.categoryId} className="card avoid-break p-3.5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="swatch" aria-hidden="true" style={{ background: fills[index] }} />
                {line.label}
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
        <li className="card avoid-break bg-[var(--surface-sunken)] p-3.5">
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
        <li className="card border-2 border-[var(--border-strong)] p-3.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold">Total</h3>
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
