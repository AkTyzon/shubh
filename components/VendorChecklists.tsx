import { formatExact } from "@/lib/budget";
import { checklistsForCategory } from "@/lib/knowledge/vendors";
import type { BudgetPlan, EventTypeId } from "@/lib/types";

/**
 * Vendor checklists.
 *
 * What to ask before you pay anyone, and what to get in writing — one of the
 * four things the problem statement names, and the one where money is actually
 * lost. It is lost to the same handful of omissions every time: a per-plate quote
 * with no stated headcount, a venue booking with no overtime rate, a
 * photographer whose delivery date was never agreed. By the time any of those
 * surface, the advance is gone.
 *
 * Each checklist is attached to the budget line it spends, and shows that line's
 * allocated figure beside it, so "what am I asking about" and "what am I paying"
 * are answered in the same place.
 *
 * Built on `<details>` rather than a JavaScript accordion: it opens with
 * scripting disabled, is keyboard accessible without any work, is announced
 * correctly by screen readers, and the print stylesheet forces every one open so
 * a printed plan is the whole plan.
 */
export function VendorChecklists({
  eventType,
  budget,
}: {
  eventType: EventTypeId;
  budget: BudgetPlan;
}) {
  // Walked in budget order, so the checklists appear in the same sequence as the
  // table above rather than in catalogue order.
  const sections = budget.lines.flatMap((line) =>
    checklistsForCategory(eventType, line.categoryId).map((checklist) => ({ line, checklist })),
  );

  if (sections.length === 0) return null;

  const total = sections.reduce(
    (sum, { checklist }) =>
      sum + checklist.questions.length + checklist.inWriting.length + checklist.redFlags.length,
    0,
  );

  return (
    <section aria-labelledby="vendors-heading" className="grid gap-5">
      <header>
        <h2 id="vendors-heading" className="text-2xl font-semibold sm:text-3xl">
          Before you pay anyone
        </h2>
        <p className="mt-1.5 max-w-2xl text-[var(--text-soft)]">
          {total} things to ask, get in writing, or walk away from — across{" "}
          {sections.length} {sections.length === 1 ? "vendor" : "vendors"}, each attached to the
          budget line it spends. None of it quotes a price: the rupee figures all come from your
          computed plan.
        </p>
      </header>

      <ul className="grid gap-2.5">
        {sections.map(({ line, checklist }) => (
          <li key={`${line.categoryId}-${checklist.vendorName}`}>
            <details className="disclosure card avoid-break overflow-hidden">
              <summary className="p-4">
                <span>
                  <span className="block font-semibold">{checklist.vendorName}</span>
                  <span className="block text-sm text-[var(--text-soft)]">
                    Paid from {line.label.toLowerCase()} ·{" "}
                    <span className="nums font-semibold text-[var(--text)]">
                      {formatExact(line.allocated)}
                    </span>
                  </span>
                </span>
              </summary>

              <div className="grid gap-5 border-t bg-[var(--surface-sunken)] p-4 sm:grid-cols-2">
                <Block
                  title="Ask before you commit"
                  tone="var(--accent)"
                  items={checklist.questions}
                />
                <Block title="Get in writing" tone="var(--good)" items={checklist.inWriting} />
                <Block title="Red flags" tone="var(--bad)" items={checklist.redFlags} />
                <div>
                  <h4
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{ color: "var(--cool)" }}
                  >
                    Paying
                  </h4>
                  <p className="mt-1.5 text-sm text-[var(--text-soft)]">{checklist.payment}</p>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Block({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold tracking-widest uppercase" style={{ color: tone }}>
        {title}
      </h4>
      <ul className="mt-1.5 grid list-disc gap-1 pl-4 text-sm text-[var(--text-soft)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
