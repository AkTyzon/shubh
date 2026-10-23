/**
 * The page.
 *
 * A server component. When the query string carries a plan, the budget, the
 * schedule, the vendor checklists and the feasibility findings are all computed
 * here and arrive in the HTML response — so the product works with JavaScript
 * disabled, on a slow phone, and in a text browser. The only client island is
 * the AI explanation, which genuinely cannot work without a network call.
 *
 * `data-occasion` on the outer wrapper is what themes everything: a wedding, a
 * child's birthday, a housewarming and a society programme each get their own
 * palette, gradient and motif, resolved in CSS at no JavaScript cost.
 *
 * The examples are built relative to the server's date rather than hard-coded,
 * so "a wedding ten days away" stays ten days away forever instead of quietly
 * becoming a date in the past.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { BudgetSection } from "@/components/BudgetSection";
import { FeasibilityPanel } from "@/components/FeasibilityPanel";
import { Narrative } from "@/components/Narrative";
import { PlanActions } from "@/components/PlanActions";
import { PlanForm } from "@/components/PlanForm";
import { Timeline } from "@/components/Timeline";
import { VendorChecklists } from "@/components/VendorChecklists";
import { formatExact, formatMoney } from "@/lib/budget";
import { resolveProvider } from "@/lib/llm";
import { buildPlan, parsePlanInput, PlanInputError } from "@/lib/plan";
import { planToQuery, readPlanParams, type RawPlanParams } from "@/lib/share";
import { occasionFor, OCCASION_LIST } from "@/lib/theme";
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

  const occasion = occasionFor(plan?.input.eventType ?? "wedding");
  // Only the label reaches the browser. The key never leaves the server.
  const provider = resolveProvider(process.env);

  return (
    <div data-occasion={occasion.id} className="min-h-dvh">
      <header className="no-print sticky top-0 z-20 border-b bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="display text-2xl font-semibold text-[var(--accent)]">Shubh</span>
            {/* `lang` on the Devanagari so a screen reader switches voice rather
                than spelling it out with an English phoneme set. */}
            <span lang="hi" className="display text-xl text-[var(--text-soft)]">
              शुभ
            </span>
          </Link>
          <p className="text-sm text-[var(--text-soft)]">
            Celebration planning where the numbers add up
          </p>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {!plan && <Hero />}

        {inputError && (
          <p
            role="alert"
            className="mb-6 rounded-[var(--radius)] border border-[var(--bad)] bg-[var(--bad-soft)] p-4 text-sm"
          >
            {inputError}
          </p>
        )}

        <div className="grid gap-10">
          <PlanForm current={plan?.input} today={today} />

          {!plan && <Examples today={today} />}

          {plan && (
            <>
              <div className="rise rise-1">
                <PlanHeader plan={plan} />
              </div>
              <div className="rise rise-2">
                <FeasibilityPanel issues={plan.issues} />
              </div>
              <div className="rise rise-3">
                <BudgetSection budget={plan.budget} input={plan.input} occasion={occasion} />
              </div>
              <div className="rise rise-4">
                <Timeline timeline={plan.timeline} />
              </div>
              <div className="rise rise-5">
                <VendorChecklists eventType={plan.input.eventType} budget={plan.budget} />
              </div>
              <Narrative input={plan.input} providerLabel={provider?.label ?? null} />
              <Methodology />
            </>
          )}
        </div>
      </main>

      <footer className="no-print mt-14 border-t bg-[var(--surface-raised)]">
        <div className="mx-auto grid max-w-5xl gap-2 px-4 py-7 text-sm text-[var(--text-soft)] sm:px-6">
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
              : "No AI model is configured here, so explanations come from the built-in narrative — computed from your plan."}
          </p>
          <p>
            Cost benchmarks are typical Indian market ranges by city tier. They are a starting
            point for a conversation with a vendor, not a quotation.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------------- intro */

function Hero() {
  return (
    <div className="mb-10 grid gap-7">
      <div className="hero rise p-6 sm:p-10">
        <span className="garland" aria-hidden="true" />
        <p className="mb-3 text-xs font-bold tracking-[0.18em] uppercase text-[var(--accent)]">
          Weddings · Birthdays · Griha Pravesh · Society functions
        </p>
        <h1 className="max-w-3xl text-3xl leading-tight font-semibold sm:text-5xl">
          Plan the celebration.{" "}
          <span className="text-[var(--accent)]">Not the spreadsheet.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[var(--text-soft)] sm:text-lg">
          Tell Shubh the date, the headcount, the city and what you can spend. Get back a budget
          that balances to the rupee, a schedule built backwards from the date, the questions to
          ask every vendor, and ideas that fit the money you actually have.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {OCCASION_LIST.map((occasion) => (
            <span
              key={occasion.id}
              data-occasion={occasion.id}
              className="pill border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]"
            >
              <span aria-hidden="true">{occasion.glyph}</span>
              {occasion.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Claim glyph="🧮" title="Every rupee is computed">
          The AI never produces a number. Allocation is arithmetic over published cost
          benchmarks, and the code refuses to return a budget whose parts do not sum to the whole.
        </Claim>
        <Claim glyph="🔍" title="Every AI figure is checked">
          The explanation is generated, then each rupee amount and date in it is matched against
          your computed plan. Anything invented is struck through and labelled — you see the
          tally, you are not asked to trust it.
        </Claim>
        <Claim glyph="🤝" title="It tells you the truth">
          ₹3 lakh for 400 guests in Mumbai is not a plan that needs encouragement. You get the
          per-head arithmetic, the gap, and the guest count your money actually covers.
        </Claim>
      </div>
    </div>
  );
}

function Claim({
  glyph,
  title,
  children,
}: {
  glyph: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden="true" className="text-xl">
          {glyph}
        </span>
        {title}
      </h2>
      <p className="mt-1.5 text-sm text-[var(--text-soft)]">{children}</p>
    </div>
  );
}

/**
 * One-click examples.
 *
 * Dates are offsets from today, so each example keeps demonstrating the thing it
 * was chosen for. Two are deliberately impossible: a planning tool that only
 * ever shows happy paths is not being tested.
 */
function Examples({ today }: { today: string }) {
  const examples = [
    {
      glyph: "💐",
      label: "Metro wedding · 300 guests · ₹25 lakh",
      note: "A plan that works, with nothing overdue. Nine months out.",
      // 270 days clears the longest lead time in the wedding graph (240 days,
      // for agreeing the budget), which is what "a plan that works" has to mean.
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
      glyph: "🚫",
      label: "Metro wedding · 400 guests · ₹3 lakh",
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
      glyph: "⏳",
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
      glyph: "🪙",
      label: "Tier-2 wedding · 150 guests · ₹4.8 lakh",
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
      glyph: "🎂",
      label: "Child's birthday · 40 guests · ₹1 lakh",
      note: "A different occasion, a different theme and category set.",
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
      glyph: "🎊",
      label: "Society Diwali programme · 400 people · ₹1.5 lakh",
      note: "Volunteer-run, with permissions and crowd safety in the plan.",
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
      <h2 id="examples-heading" className="text-xl font-semibold sm:text-2xl">
        Or open one of these
      </h2>
      <p className="mt-1 text-sm text-[var(--text-soft)]">
        Each is a link, so the computed plan appears immediately. Two of them do not work on
        purpose.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {examples.map((example) => (
          <li key={example.label}>
            <Link
              href={`/?${example.query}`}
              // Six dynamic pages are not worth prefetching on a mobile
              // connection just because the cards are on screen.
              prefetch={false}
              className="card card-interactive flex h-full items-start gap-3 p-3.5"
            >
              <span aria-hidden="true" className="text-xl">
                {example.glyph}
              </span>
              <span>
                <span className="block font-semibold">{example.label}</span>
                <span className="block text-sm text-[var(--text-soft)]">{example.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ plan */

function PlanHeader({ plan }: { plan: Plan }) {
  const { input, budget, timeline } = plan;
  const occasion = occasionFor(input.eventType);
  const ratio = budget.total / budget.benchmarkTypical;

  return (
    <section aria-labelledby="summary-heading" className="hero p-5 sm:p-7">
      <span className="garland" aria-hidden="true" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[var(--accent)]">
            Your plan
          </p>
          <h2 id="summary-heading" className="mt-1 flex items-center gap-2.5 text-2xl font-semibold sm:text-3xl">
            <span aria-hidden="true">{occasion.glyph}</span>
            {input.city ? `${titleCase(occasion.noun)} in ${input.city}` : titleCase(occasion.noun)}
          </h2>
          <p className="mt-1 text-[var(--text-soft)]">
            {displayDate(input.eventDate)} ·{" "}
            {timeline.daysAvailable >= 0
              ? `${timeline.daysAvailable} ${timeline.daysAvailable === 1 ? "day" : "days"} away`
              : `${Math.abs(timeline.daysAvailable)} days ago`}{" "}
            · {input.guestCount} {input.guestCount === 1 ? "guest" : "guests"}
          </p>
        </div>
        <PlanActions />
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Budget" value={formatExact(budget.total)}>
          {formatMoney(budget.perGuest)} per guest
        </Stat>
        <Stat label="Typical at this size" value={formatMoney(budget.benchmarkTypical)}>
          you are at {Math.round(ratio * 100)}% of it
        </Stat>
        <Stat label="Held back" value={formatExact(budget.contingency)}>
          contingency, inside the budget
        </Stat>
        <Stat label="Tasks" value={String(timeline.tasks.length)}>
          {timeline.overdue.length > 0
            ? `${timeline.overdue.length} already overdue`
            : "none overdue"}
        </Stat>
      </dl>
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
      <dd className="nums display mt-0.5 text-xl font-semibold">{value}</dd>
      <dd className="text-sm text-[var(--text-soft)]">{children}</dd>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ----------------------------------------------------------- methodology */

function Methodology() {
  return (
    <section
      aria-labelledby="method-heading"
      className="rounded-[var(--radius)] border bg-[var(--surface-sunken)] p-5 sm:p-6"
    >
      <h2 id="method-heading" className="text-xl font-semibold sm:text-2xl">
        How these numbers were produced
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-soft)]">
        Nothing on this page above the explanation came from a language model. Here is what
        produced it instead.
      </p>

      <div className="mt-4 grid gap-5 text-sm leading-relaxed text-[var(--text-soft)] sm:grid-cols-2">
        <div>
          <h3 className="font-semibold text-[var(--text)]">The budget</h3>
          <p className="mt-1">
            Your total is split by the category shares for this occasion, with any priority you
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
            the generated explanation is checked against that set: matched, rounded (shown with
            the exact value), or invented. One honest limitation — the check compares values, not
            meanings, so a figure that happens to equal a real one passes even if the model
            attached it to the wrong category.
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm text-[var(--text-soft)]">
        Benchmarks are typical ranges, not quotations. Prices move with season, day of the week
        and how hard you negotiate. Use these to know when a quote is out of line, then get the
        real number in writing.
      </p>
    </section>
  );
}
