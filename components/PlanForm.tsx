"use client";

/**
 * The plan form.
 *
 * A real `<form method="get" action="/">`. That is the whole architecture: the
 * browser submits it, the server reads the query string, computes the plan and
 * returns the finished HTML. **With JavaScript disabled, everything still
 * works** — budget, schedule, feasibility findings, all of it.
 *
 * It is a client component purely for enhancement: when JavaScript is available,
 * changing the event type swaps the priority checkboxes to that event's
 * categories without a round trip. Without it, the checkboxes rendered by the
 * server for the current event type are still submitted correctly, so the
 * degraded path is a working form rather than a broken one.
 *
 * Validation is intentionally thin here. `parsePlanInput` on the server is the
 * single authority, and duplicating its rules in the browser is how the two
 * surfaces end up disagreeing about what is acceptable.
 */

import { useId, useState } from "react";
import { CITY_TIERS, COST_CATEGORIES } from "@/lib/knowledge/costs";
import { EVENT_TYPES, LIMITS } from "@/lib/plan";
import { FIELD } from "@/lib/share";
import type { CityTier, EventTypeId, PlanInput } from "@/lib/types";

interface Props {
  /** Current values, so a shared link reopens the form as it was submitted. */
  current?: PlanInput;
  /** Today on the server, used as the date input's minimum. */
  today: string;
}

export function PlanForm({ current, today }: Props) {
  const [eventType, setEventType] = useState<EventTypeId>(current?.eventType ?? "wedding");
  const formId = useId();

  const categories = COST_CATEGORIES[eventType];
  const selectedPriorities = new Set(current?.priorities ?? []);

  return (
    <form
      method="get"
      action="/"
      className="no-print grid gap-5 rounded-xl border bg-[var(--surface-raised)] p-5 shadow-sm sm:p-6"
      aria-labelledby={`${formId}-heading`}
    >
      <h2 id={`${formId}-heading`} className="font-serif text-xl font-semibold">
        What are you planning?
      </h2>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Occasion</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {EVENT_TYPES.map((type) => (
            <label
              key={type.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                eventType === type.id
                  ? "border-[var(--accent)] bg-[var(--color-marigold-soft)]"
                  : "bg-[var(--surface)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              <input
                type="radio"
                name={FIELD.eventType}
                value={type.id}
                defaultChecked={eventType === type.id}
                onChange={() => setEventType(type.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-semibold">{type.label}</span>
                <span className="block text-[var(--text-soft)]">{type.blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Event date"
          hint="The main day. Everything is scheduled backwards from it."
          htmlFor={`${formId}-date`}
        >
          <input
            id={`${formId}-date`}
            type="date"
            name={FIELD.eventDate}
            required
            aria-describedby={hintId(`${formId}-date`)}
            min={today}
            defaultValue={current?.eventDate}
            className={inputClass}
          />
        </Field>

        <Field
          label="Guests"
          hint="Total headcount across functions."
          htmlFor={`${formId}-guests`}
        >
          <input
            id={`${formId}-guests`}
            type="number"
            name={FIELD.guestCount}
            required
            aria-describedby={hintId(`${formId}-guests`)}
            inputMode="numeric"
            min={LIMITS.minGuests}
            max={LIMITS.maxGuests}
            step={1}
            placeholder="250"
            defaultValue={current?.guestCount}
            className={`${inputClass} nums`}
          />
        </Field>

        <Field
          label="Total budget"
          hint="In rupees. Everything you expect to spend, not per function."
          htmlFor={`${formId}-budget`}
        >
          <div className="flex items-stretch">
            <span
              aria-hidden="true"
              className="flex items-center rounded-l-lg border border-r-0 bg-[var(--surface-sunken)] px-3 text-sm text-[var(--text-soft)]"
            >
              ₹
            </span>
            <input
              id={`${formId}-budget`}
              type="number"
              name={FIELD.totalBudget}
              required
              aria-describedby={hintId(`${formId}-budget`)}
              inputMode="numeric"
              min={LIMITS.minBudget}
              max={LIMITS.maxBudget}
              step={1000}
              placeholder="1500000"
              defaultValue={current?.totalBudget}
              className={`${inputClass} nums rounded-l-none`}
            />
          </div>
        </Field>

        <Field
          label="Where"
          hint="Cost varies more by city tier than by anything else."
          htmlFor={`${formId}-tier`}
        >
          <select
            id={`${formId}-tier`}
            name={FIELD.cityTier}
            required
            aria-describedby={hintId(`${formId}-tier`)}
            defaultValue={current?.cityTier ?? ("tier1" satisfies CityTier)}
            className={inputClass}
          >
            {CITY_TIERS.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label} — {tier.examples}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="City"
        hint="Optional. Used only to make the suggestions more specific."
        htmlFor={`${formId}-city`}
      >
        <input
          id={`${formId}-city`}
          type="text"
          name={FIELD.city}
          maxLength={60}
          aria-describedby={hintId(`${formId}-city`)}
          placeholder="Nagpur"
          defaultValue={current?.city}
          autoComplete="address-level2"
          className={inputClass}
        />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">
          What you will not compromise on{" "}
          <span className="font-normal text-[var(--text-soft)]">(optional)</span>
        </legend>
        <p className="text-sm text-[var(--text-soft)]">
          These get funded first. The money comes from the other categories, and the plan will
          show you exactly where from.
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-sunken)] has-checked:border-[var(--accent)] has-checked:bg-[var(--color-marigold-soft)]"
            >
              <input
                type="checkbox"
                name={FIELD.priorities}
                value={category.id}
                defaultChecked={selectedPriorities.has(category.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {category.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
        >
          Compute the plan
        </button>
        <p className="text-sm text-[var(--text-soft)]">
          No account, no sign-in. The plan is arithmetic, not a model.
        </p>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-[var(--text)] " +
  "placeholder:text-[var(--text-soft)]";

/**
 * Label, hint and control.
 *
 * The hint carries `id={hintId(htmlFor)}` and every control references it with
 * `aria-describedby`. Without that wiring a screen-reader user hears the label
 * and the input and never the explanation of what the field means — which, for
 * "city tier", is the entire content of the field.
 */
function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      <p id={hintId(htmlFor)} className="text-xs text-[var(--text-soft)]">
        {hint}
      </p>
    </div>
  );
}

/** One place that derives a hint's id, so a control cannot point at the wrong one. */
function hintId(controlId: string): string {
  return `${controlId}-hint`;
}
