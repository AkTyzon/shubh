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
import {
  Arch,
  BudgetMock,
  ChecklistMock,
  Confetti,
  Diya,
  Rangoli,
  TimelineMock,
  Toran,
  VerifiedMock,
} from "@/components/Decor";
import { BudgetSection } from "@/components/BudgetSection";
import { FeasibilityPanel } from "@/components/FeasibilityPanel";
import { Narrative } from "@/components/Narrative";
import { PlanActions } from "@/components/PlanActions";
import { PlanForm } from "@/components/PlanForm";
import { Timeline } from "@/components/Timeline";
import { VendorChecklists } from "@/components/VendorChecklists";
import { formatExact, formatMoney } from "@/lib/budget";
import { COST_CATEGORIES } from "@/lib/knowledge/costs";
import { IDEAS } from "@/lib/knowledge/ideas";
import { TASK_TEMPLATES } from "@/lib/knowledge/timelines";
import { VENDOR_CHECKLISTS } from "@/lib/knowledge/vendors";
import { resolveProvider } from "@/lib/llm";
import { buildPlan, parsePlanInput, PlanInputError } from "@/lib/plan";
import { planToQuery, readPlanParams, type RawPlanParams } from "@/lib/share";
import { occasionFor } from "@/lib/theme";
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

      <main id="main">
        {!plan && <Landing />}

        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {inputError && (
          <p
            role="alert"
            className="mb-6 rounded-[var(--radius)] border border-[var(--bad)] bg-[var(--bad-soft)] p-4 text-sm"
          >
            {inputError}
          </p>
        )}

        <div className="grid gap-10">
          {plan ? (
            /* The plan leads. Somebody who has just pressed "Plan it" should see
               their budget, not scroll past the form they only just filled in —
               so the form moves below the result and collapses into a
               disclosure. Native <details>, so it still opens with no JS. */
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

              <details id="plan" className="disclosure card scroll-mt-24 overflow-hidden">
                <summary className="p-5">
                  <span>
                    <span className="block text-lg font-semibold">Change something</span>
                    <span className="block text-sm text-[var(--text-soft)]">
                      Move the date, adjust the budget, or try a different headcount.
                    </span>
                  </span>
                </summary>
                <div className="border-t p-4 sm:p-5">
                  <PlanForm current={plan.input} today={today} />
                </div>
              </details>
            </>
          ) : (
            <>
              <section id="plan" aria-label="Plan your celebration" className="scroll-mt-24">
                <div className="mb-6 max-w-2xl">
                  <p className="text-xs font-bold tracking-[0.22em] uppercase text-[var(--accent)]">
                    Start here
                  </p>
                  <h2 className="section-title mt-3 font-semibold">Tell us about the day</h2>
                </div>
                <PlanForm today={today} />
              </section>

              <Examples today={today} />
            </>
          )}
          </div>
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

/* --------------------------------------------------------------- landing */

/**
 * The landing experience.
 *
 * Full-bleed bands rather than one long column, because a page that never
 * touches the edge of the window reads as a document. Each band has its own
 * background and rhythm: hero, a dark stats strip, the four things the product
 * does, and how it works.
 *
 * Every decorative piece here is `aria-hidden` or `alt=""`, and the reveal
 * animations are pure CSS view timelines, so the whole section costs no
 * JavaScript and degrades to plain visible content where unsupported.
 */
function Landing() {
  return (
    <>
      <HeroBand />
      <StatsBand />
      <FeatureBand />
      <StepsBand />
    </>
  );
}

function HeroBand() {
  return (
    <section className="relative overflow-hidden">
      <div className="mesh" aria-hidden="true" />
      <Toran className="absolute inset-x-0 top-0 z-10 opacity-70" />

      {/* The rangoli sits behind the type, bleeding off the right edge. */}
      <Rangoli
        className="absolute -top-24 -right-40 w-[34rem] sm:-right-24 lg:right-4 lg:w-[40rem]"
        style={{ opacity: "var(--decor-rangoli)" }}
      />

      {/* The headline is capped at max-w-4xl inside a max-w-6xl column, so the
          right-hand strip is the only space a floating ornament can occupy
          without ever landing on top of the type. An earlier pair sat on the
          left and covered the first word. */}
      <Diya className="absolute top-[30%] right-[5%] hidden w-14 text-[var(--accent)] opacity-85 xl:block float" />
      <Diya className="absolute right-[13%] bottom-28 hidden w-9 text-[var(--accent)] opacity-65 xl:block float-slow float-delay" />
      <Confetti
        className="absolute inset-x-0 top-24 h-20 text-[var(--accent)]"
        style={{ opacity: "var(--decor-confetti)" }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 sm:pt-36 sm:pb-28">
        <p className="mb-5 text-xs font-bold tracking-[0.22em] uppercase text-[var(--accent)]">
          Weddings · Birthdays · Griha Pravesh · Society functions
        </p>

        <h1 className="headline max-w-4xl font-semibold">
          Plan the celebration.
          <br />
          <span className="sweep">Not the spreadsheet.</span>
        </h1>

        <p className="subhead mt-7 max-w-2xl text-[var(--text-soft)]">
          Tell Shubh the date, the headcount, the city and what you can spend. Get back a budget
          that balances to the rupee, a schedule built backwards from the date, the questions to
          ask every vendor, and ideas that fit the money you actually have.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a href="#plan" className="btn-primary text-base">
            Plan my celebration →
          </a>
          <a href="#how" className="btn-quiet px-5 py-3 text-base">
            See how it works
          </a>
        </div>

        <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[var(--text-soft)]">
          <span>
            <span aria-hidden="true" className="text-[var(--good)]">
              ✓
            </span>{" "}
            No sign-in
          </span>
          <span>
            <span aria-hidden="true" className="text-[var(--good)]">
              ✓
            </span>{" "}
            Works with no AI key
          </span>
          <span>
            <span aria-hidden="true" className="text-[var(--good)]">
              ✓
            </span>{" "}
            Free, and nothing is stored
          </span>
        </p>
      </div>
    </section>
  );
}

/**
 * The stats strip.
 *
 * Real counts, pulled from the knowledge modules at render rather than typed
 * into the markup — so they cannot drift from what the product actually
 * contains, which is the usual fate of a number on a landing page.
 */
function StatsBand() {
  const categories = Object.values(COST_CATEGORIES).reduce((sum, list) => sum + list.length, 0);
  const tasks = Object.values(TASK_TEMPLATES).reduce((sum, list) => sum + list.length, 0);
  const checklists = Object.values(VENDOR_CHECKLISTS).reduce((sum, list) => sum + list.length, 0);
  const ideas = Object.values(IDEAS).reduce((sum, list) => sum + list.length, 0);

  const stats = [
    { value: categories, label: "budget categories", detail: "across four occasions" },
    { value: tasks, label: "scheduled tasks", detail: "each with a real lead time" },
    { value: checklists, label: "vendor checklists", detail: "one per budget line" },
    { value: ideas, label: "curated ideas", detail: "tagged by budget band" },
  ];

  return (
    <section className="band relative overflow-hidden py-12 sm:py-16">
      <div
        className="jaali absolute inset-0"
        style={{ opacity: "var(--decor-jaali-band)" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="reveal">
            <p className="band-value display nums text-4xl font-semibold sm:text-5xl">
              {stat.value}
            </p>
            <p className="mt-1 font-semibold">{stat.label}</p>
            <p className="band-label mt-0.5 text-sm">{stat.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The four things the product does.
 *
 * Alternating rows of text and a preview of the real interface. The previews are
 * built from the product's own primitives rather than screenshots, so they
 * cannot go stale, they re-theme with the page, and they stay sharp at any zoom.
 */
function FeatureBand() {
  const features = [
    {
      eyebrow: "Budgets",
      title: "A budget that balances to the rupee",
      body:
        "Your total is split across the categories that occasion actually has, with anything " +
        "you refuse to compromise on funded first. Every line is scored against what it really " +
        "costs for your headcount in your city tier. Allocations plus contingency equal your " +
        "total exactly — the code refuses to return a budget that does not.",
      art: <BudgetMock />,
    },
    {
      eyebrow: "Timelines",
      title: "A schedule built backwards from the date",
      body:
        "Every task carries the lead time it genuinely needs and the tasks it depends on. Dates " +
        "run backwards from your event, and when a lead time no longer fits, you are told how " +
        "many days late it already is — instead of it being quietly moved to tomorrow to keep " +
        "the list looking tidy.",
      art: <TimelineMock />,
    },
    {
      eyebrow: "Vendor checklists",
      title: "The questions to ask before you pay anyone",
      body:
        "One checklist per budget line: what to ask, what to get in writing, the red flags, and " +
        "what a normal payment schedule looks like. This is where money actually goes missing, " +
        "and it goes to the same handful of omissions every time.",
      art: <ChecklistMock />,
    },
    {
      eyebrow: "Personalised ideas",
      title: "Suggestions that fit the money you have",
      body:
        "The AI writes the ideas and the explanation — and then every rupee figure and date it " +
        "states is checked against your computed plan. Anything invented is struck through where " +
        "it appears, and you are shown the tally rather than asked to trust it.",
      art: <VerifiedMock />,
    },
  ];

  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.22em] uppercase text-[var(--accent)]">
          What you get
        </p>
        <h2 id="features-heading" className="section-title mt-3 font-semibold">
          Four things, and all of them computed
        </h2>
      </div>

      <div className="mt-14 grid gap-16 sm:gap-24">
        {features.map((feature, index) => (
          <div
            key={feature.eyebrow}
            className="reveal grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
          >
            <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
              <p className="text-xs font-bold tracking-[0.18em] uppercase text-[var(--accent)]">
                {feature.eyebrow}
              </p>
              <h3 className="mt-2.5 text-2xl font-semibold sm:text-3xl">{feature.title}</h3>
              <p className="mt-3.5 text-[var(--text-soft)]">{feature.body}</p>
            </div>
            <div className={`halo ${index % 2 === 1 ? "lg:order-1" : ""}`}>{feature.art}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepsBand() {
  const steps = [
    {
      title: "Tell it the basics",
      body: "The occasion, the date, how many people, where, and what you can spend. Five fields.",
    },
    {
      title: "Get the computed plan",
      body:
        "Budget, schedule, vendor checklists and an honest answer about whether it is possible " +
        "at all. No AI involved, and no key needed.",
    },
    {
      title: "Ask for ideas, verified",
      body:
        "The AI explains the plan and suggests things that fit it. Every figure it states is " +
        "checked against the plan before you see it.",
    },
  ];

  return (
    <section id="how" aria-labelledby="how-heading" className="bleed relative overflow-hidden">
      <div
        className="jaali absolute inset-0"
        style={{ opacity: "var(--decor-jaali)" }}
        aria-hidden="true"
      />
      <Arch
        className="absolute -top-6 left-1/2 w-72 -translate-x-1/2 text-[var(--accent)]"
        style={{ opacity: "var(--decor-arch)" }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold tracking-[0.22em] uppercase text-[var(--accent)]">
            How it works
          </p>
          <h2 id="how-heading" className="section-title mt-3 font-semibold">
            Three steps, about a minute
          </h2>
        </div>

        <ol className="steps mt-14 grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="card reveal flex gap-4 p-5">
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--text-soft)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
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
