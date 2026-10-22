/**
 * The page.
 *
 * A server component. When the query string carries a plan, the budget, the
 * schedule and the feasibility findings are computed here and arrive in the HTML
 * response — so the product works with JavaScript disabled, on a slow phone, and
 * in a text browser. The only client island is the AI explanation, which
 * genuinely cannot work without a network call.
 *
 * The examples are built relative to the server's date rather than hard-coded,
 * so "a wedding ten days away" stays ten days away forever instead of quietly
 * becoming a date in the past.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { BudgetTable } from "@/components/BudgetTable";
import { FeasibilityPanel } from "@/components/FeasibilityPanel";
import { Narrative } from "@/components/Narrative";
import { PlanActions } from "@/components/PlanActions";
import { PlanForm } from "@/components/PlanForm";
import { TimelineList } from "@/components/TimelineList";
import { formatExact, formatMoney } from "@/lib/budget";
import { resolveProvider } from "@/lib/llm";
import { buildPlan, parsePlanInput, PlanInputError } from "@/lib/plan";
import { planToQuery, readPlanParams, type RawPlanParams } from "@/lib/share";
import { addDays, displayDate } from "@/lib/timeline";
import type { Plan } from "@/lib/types";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Recomputed per request: the plan depends on today's date. */
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RawPlanParams>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const raw = readPlanParams(params);

  let plan: Plan | null = null;
  let inputError: string | null = null;

  if (raw) {
    try {
      plan = buildPlan(parsePlanInput({ ...raw, today }));
    } catch (error) {
      inputError =
        error instanceof PlanInputError
          ? error.message
          : "Could not compute a plan from that link.";
    }
  }

  // Only the label reaches the browser. The key never leaves the server.
  const provider = resolveProvider(process.env);

  return (
    <div className="min-h-dvh">
      <header className="no-print border-b bg-[var(--surface-raised)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold text-[var(--accent)]">Shubh</span>
            {/* `lang` on the Devanagari so a screen reader switches voice rather
                than spelling it out with an English phoneme set. */}
            <span lang="hi" className="font-serif text-xl text-[var(--text-soft)]">
              शुभ
            </span>
          </Link>
          <p className="text-sm text-[var(--text-soft)]">
            Celebration planning where the numbers add up
          </p>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {!plan && <Intro />}

        {inputError && (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-[var(--color-bad)] bg-[var(--color-bad-soft)] p-4 text-sm"
          >
            {inputError}
          </p>
        )}

        <div className="grid gap-8">
          <PlanForm current={plan?.input} today={today} />

          {!plan && <Examples today={today} />}

          {plan && (
            <>
              <PlanSummary plan={plan} />
              <FeasibilityPanel issues={plan.issues} />
              <BudgetTable budget={plan.budget} input={plan.input} />
              <TimelineList timeline={plan.timeline} />
              <Narrative input={plan.input} providerLabel={provider?.label ?? null} />
              <Methodology />
            </>
          )}
        </div>
      </main>

      <footer className="no-print mt-12 border-t bg-[var(--surface-raised)]">
        <div className="mx-auto grid max-w-5xl gap-2 px-4 py-6 text-sm text-[var(--text-soft)] sm:px-6">
          <p>
            <strong className="text-[var(--text)]">Shubh</strong> — budgets computed in code,
            schedules computed backwards from the date, and every AI-stated figure checked against
            the plan before you see it.
          </p>
          <p>
            {provider
              ? provider.onDevice
                ? `Explanations run on ${provider.label}. Nothing you type leaves this machine.`
                : `Explanations run on ${provider.label}. Your plan inputs are sent to it; nothing is stored.`
              : "No model configured — explanations come from the built-in narrative, computed from your plan."}
          </p>
          <p>
            Cost benchmarks are typical Indian market ranges by city tier, documented in{" "}
            <code className="rounded bg-[var(--surface-sunken)] px-1">lib/knowledge/costs.ts</code>
            . They are a starting point for a conversation with a vendor, not a quotation.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Intro() {
  return (
    <div className="mb-8 grid gap-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          Plan a celebration on a budget that actually balances
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--text-soft)]">
          Weddings, birthdays, griha pravesh, society functions. Tell Shubh the date, the
          headcount, the city and what you can spend. It returns an allocation that sums{" "}
          <em>exactly</em> to your budget, a schedule computed backwards from the date with
          dependencies enforced, and a straight answer about whether the plan is possible at all.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Claim title="Every rupee is computed">
          The model never produces a number. Allocation is arithmetic over published cost
          benchmarks, and the code throws rather than return a budget whose parts do not sum to
          the whole.
        </Claim>
        <Claim title="Every AI figure is checked">
          The explanation is generated, then each rupee amount and date in it is extracted and
          matched against the computed plan. Anything invented is struck through and labelled —
          you are shown the tally, not asked to trust it.
        </Claim>
        <Claim title="It will tell you no">
          ₹3 lakh for 400 guests in Mumbai is not a plan that needs encouragement. You get the
          per-head arithmetic, the gap, and the guest count your money actually covers.
        </Claim>
      </div>

      <details className="rounded-xl border bg-[var(--surface-raised)] p-4">
        <summary className="cursor-pointer font-semibold">
          Why not just ask ChatGPT or Gemini to plan my wedding?
        </summary>
        <div className="mt-3 grid gap-3 text-sm leading-relaxed text-[var(--text-soft)]">
          <p>
            Because you will get a confident, tidy, plausible table whose rows do not add up to
            your budget — and checking it is exactly the work you were trying to avoid. Ask the
            same model twice and you get two different budgets. Neither tells you that the date
            you picked leaves 54 days for a venue that needs 180.
          </p>
          <p>
            A language model is genuinely good at the parts of this that are about taste and
            texture: what to serve, how to make a tight budget feel generous, what to ask a
            caterer. It is unreliable at the part people act on with borrowed money. So here it
            does the first and is kept out of the second — and where it does state a figure, that
            figure is checked against the computed plan and the result is shown to you.
          </p>
          <p>
            That split is the whole design. It is also why the plan works with no API key
            configured at all: the arithmetic never needed one.
          </p>
        </div>
      </details>
    </div>
  );
}

function Claim({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-[var(--surface-raised)] p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm text-[var(--text-soft)]">{children}</p>
    </div>
  );
}

/**
 * One-click examples.
 *
 * Dates are offsets from today, so each example keeps demonstrating the thing it
 * was chosen to demonstrate. Two of them are deliberately impossible: a planning
 * tool that only ever shows happy paths is not being tested.
 */
function Examples({ today }: { today: string }) {
  const examples = [
    {
      label: "Metro wedding, 300 guests, ₹25 lakh",
      // 270 days clears the longest lead time in the wedding graph (240 days,
      // for agreeing the budget), so this example has nothing overdue -- which
      // is what "a plan that works" has to mean for it to be worth showing.
      note: "A plan that works, with nothing overdue. Nine months out.",
      query: planToQuery({
        eventType: "wedding",
        eventDate: addDays(today, 270),
        guestCount: 300,
        cityTier: "metro",
        totalBudget: 2_500_000,
        priorities: ["catering"],
        today,
      }),
    },
    {
      label: "Metro wedding, 400 guests, ₹3 lakh",
      note: "Not possible. See what it says instead of pretending.",
      query: planToQuery({
        eventType: "wedding",
        eventDate: addDays(today, 150),
        guestCount: 400,
        cityTier: "metro",
        totalBudget: 300_000,
        priorities: [],
        today,
      }),
    },
    {
      label: "Wedding in ten days",
      note: "The date, not the money, is the problem.",
      query: planToQuery({
        eventType: "wedding",
        eventDate: addDays(today, 10),
        guestCount: 200,
        cityTier: "tier1",
        totalBudget: 1_200_000,
        priorities: [],
        today,
      }),
    },
    {
      label: "Tier-2 wedding, 150 guests, ₹4.8 lakh",
      note: "Tight but workable, which is where most people are.",
      query: planToQuery({
        eventType: "wedding",
        eventDate: addDays(today, 120),
        guestCount: 150,
        cityTier: "tier2",
        totalBudget: 480_000,
        priorities: ["catering", "photography"],
        today,
      }),
    },
    {
      label: "Child's birthday, 40 guests, ₹1 lakh",
      note: "A different event type, a different category set.",
      query: planToQuery({
        eventType: "birthday",
        eventDate: addDays(today, 45),
        guestCount: 40,
        cityTier: "metro",
        totalBudget: 100_000,
        priorities: [],
        today,
      }),
    },
    {
      label: "Society Diwali programme, 400 attendees, ₹1.5 lakh",
      note: "Volunteer-run, with permissions and crowd safety in the schedule.",
      query: planToQuery({
        eventType: "community",
        eventDate: addDays(today, 60),
        guestCount: 400,
        cityTier: "tier3",
        totalBudget: 150_000,
        priorities: [],
        today,
      }),
    },
  ];

  return (
    <section aria-labelledby="examples-heading" className="no-print">
      <h2 id="examples-heading" className="font-serif text-xl font-semibold">
        Or try one of these
      </h2>
      <p className="mt-1 text-sm text-[var(--text-soft)]">
        Each is a link, so you can see the computed plan immediately. Two of them do not work on
        purpose.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {examples.map((example) => (
          <li key={example.label}>
            <Link
              href={`/?${example.query}`}
              // Six dynamic pages are not worth prefetching on a mobile
              // connection just because the cards are on screen.
              prefetch={false}
              className="block h-full rounded-lg border bg-[var(--surface-raised)] p-3 hover:bg-[var(--surface-sunken)]"
            >
              <span className="block font-semibold">{example.label}</span>
              <span className="block text-sm text-[var(--text-soft)]">{example.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanSummary({ plan }: { plan: Plan }) {
  const { input, budget, timeline } = plan;
  const ratio = budget.total / budget.benchmarkTypical;

  return (
    <section
      aria-labelledby="summary-heading"
      className="rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-raised)] p-5"
    >
      <h2 id="summary-heading" className="font-serif text-xl font-semibold">
        Your plan
      </h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Budget" value={formatExact(budget.total)}>
          {formatMoney(budget.perGuest)} per guest
        </Stat>
        <Stat label="Typical at this size" value={formatMoney(budget.benchmarkTypical)}>
          you are at {Math.round(ratio * 100)}% of it
        </Stat>
        <Stat label="Event date" value={displayDate(input.eventDate)}>
          {timeline.daysAvailable >= 0
            ? `${timeline.daysAvailable} days away`
            : `${Math.abs(timeline.daysAvailable)} days ago`}
        </Stat>
        <Stat label="Tasks" value={String(timeline.tasks.length)}>
          {timeline.overdue.length > 0
            ? `${timeline.overdue.length} already overdue`
            : "none overdue"}
        </Stat>
      </dl>
      <div className="mt-4">
        <PlanActions />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide uppercase text-[var(--text-soft)]">
        {label}
      </dt>
      <dd className="nums mt-0.5 text-lg font-semibold">{value}</dd>
      <dd className="text-sm text-[var(--text-soft)]">{children}</dd>
    </div>
  );
}

function Methodology() {
  return (
    <section aria-labelledby="method-heading" className="rounded-xl border bg-[var(--surface-sunken)] p-5">
      <h2 id="method-heading" className="font-serif text-xl font-semibold">
        How these numbers were produced
      </h2>
      <div className="mt-3 grid gap-4 text-sm leading-relaxed text-[var(--text-soft)] sm:grid-cols-2">
        <div>
          <h3 className="font-semibold text-[var(--text)]">The budget</h3>
          <p className="mt-1">
            Your total is split by the category shares for this event type, with any priority you
            marked weighted up by a quarter and the difference taken from the rest. 10% is held
            back as contingency, inside your total rather than on top of it. Allocation runs in
            whole rupees and the rounding remainder is distributed, so the parts sum to the whole
            exactly — the code throws rather than return a budget that does not balance.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[var(--text)]">The verdicts</h3>
          <p className="mt-1">
            Each allocation is compared against a market range for your city tier, scaled by guest
            count — per-guest for catering and gifts, flat for a photographer, and flat-but-scaled
            for venue and decor, where a hall for 300 costs more than one for 150 but not double.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[var(--text)]">The schedule</h3>
          <p className="mt-1">
            Each task has a lead time in days. Dates are the event date minus that lead time, then
            adjusted so no task is scheduled on or after something it depends on. When a lead time
            no longer fits, the task is reported overdue with the shortfall rather than quietly
            moved to tomorrow to keep the list looking tidy.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-[var(--text)]">The verification</h3>
          <p className="mt-1">
            The plan collects every rupee figure it legitimately contains. Each figure and date in
            the generated explanation is extracted and checked against that set: matched, rounded
            (shown with the exact value), or invented. One honest limitation — the check compares
            values, not meanings, so a figure that happens to equal a real one passes even if the
            model attached it to the wrong category.
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-[var(--text-soft)]">
        Benchmarks are typical ranges, not quotations. Prices move with season, day of week and
        how hard you negotiate. Use these to know when a quote is out of line, then get the real
        number in writing.
      </p>
    </section>
  );
}
