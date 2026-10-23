"use client";

/**
 * The plan form.
 *
 * A real `<form method="get" action="/">`. That is the whole architecture: the
 * browser submits it, the server reads the query string, computes the plan and
 * returns finished HTML. **With JavaScript disabled, everything still works** —
 * budget, schedule, vendor checklists, feasibility findings, all of it.
 *
 * It is a client component purely for enhancement. With scripting available,
 * picking an occasion immediately re-themes the form and swaps the priority
 * checkboxes to that occasion's categories, with no round trip. Without it, the
 * checkboxes the server rendered for the current occasion still submit correctly,
 * so the degraded path is a working form rather than a broken one.
 *
 * Validation is intentionally thin here. `parsePlanInput` on the server is the
 * single authority; duplicating its rules in the browser is how the two surfaces
 * end up disagreeing about what is acceptable.
 */

import { useId, useState } from "react";
import { CITY_TIERS, COST_CATEGORIES } from "@/lib/knowledge/costs";
import { LIMITS } from "@/lib/plan";
import { FIELD } from "@/lib/share";
import { OCCASION_LIST } from "@/lib/theme";
import type { CityTier, EventTypeId, PlanInput } from "@/lib/types";

interface Props {
  /** Current values, so a shared link reopens the form as it was submitted. */
  current?: PlanInput;
  /** Today on the server, used as the date input's minimum. */
  today: string;
}

export function PlanForm({ current, today }: Props) {
  const [eventType, setEventType] = useState<EventTypeId>(current?.eventType ?? "wedding");
  const id = useId();

  const categories = COST_CATEGORIES[eventType];
  const selected = new Set(current?.priorities ?? []);

  return (
    // The picked occasion themes the form itself, so the colour changes under
    // your hand the moment you choose — the one piece of feedback that makes the
    // picker feel like a choice rather than a radio group.
    <form
      method="get"
      action="/"
      data-occasion={eventType}
      className="no-print card grid gap-6 p-5 sm:p-7"
      aria-labelledby={`${id}-heading`}
    >
      <div>
        <h2 id={`${id}-heading`} className="text-xl font-semibold sm:text-2xl">
          What are you planning?
        </h2>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          No account, no sign-in. The plan is arithmetic — it works with no AI key at all.
        </p>
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="mb-1 text-sm font-semibold">The occasion</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {OCCASION_LIST.map((occasion) => {
            const active = eventType === occasion.id;
            return (
              <label
                key={occasion.id}
                data-occasion={occasion.id}
                className="card card-interactive flex cursor-pointer items-start gap-3 p-3.5 text-sm"
                style={
                  active
                    ? { borderColor: "var(--accent)", background: "var(--accent-soft)" }
                    : undefined
                }
              >
                <input
                  type="radio"
                  name={FIELD.eventType}
                  value={occasion.id}
                  defaultChecked={active}
                  onChange={() => setEventType(occasion.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span aria-hidden="true">{occasion.glyph}</span>
                    {occasion.label}
                  </span>
                  <span className="mt-0.5 block text-[var(--text-soft)]">{occasion.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event date" hint="The main day. Everything schedules backwards from it." id={`${id}-date`}>
          <input
            id={`${id}-date`}
            type="date"
            name={FIELD.eventDate}
            required
            min={today}
            defaultValue={current?.eventDate}
            aria-describedby={hintId(`${id}-date`)}
            className="field nums"
          />
        </Field>

        <Field label="Guests" hint="Total headcount across all functions." id={`${id}-guests`}>
          <input
            id={`${id}-guests`}
            type="number"
            name={FIELD.guestCount}
            required
            inputMode="numeric"
            min={LIMITS.minGuests}
            max={LIMITS.maxGuests}
            step={1}
            placeholder="250"
            defaultValue={current?.guestCount}
            aria-describedby={hintId(`${id}-guests`)}
            className="field nums"
          />
        </Field>

        <Field
          label="Total budget"
          hint="In rupees — everything you expect to spend, not per function."
          id={`${id}-budget`}
        >
          <div className="flex items-stretch">
            <span
              aria-hidden="true"
              className="flex items-center rounded-l-[0.625rem] border border-r-0 border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 text-[var(--text-soft)]"
            >
              ₹
            </span>
            <input
              id={`${id}-budget`}
              type="number"
              name={FIELD.totalBudget}
              required
              inputMode="numeric"
              min={LIMITS.minBudget}
              max={LIMITS.maxBudget}
              step={1000}
              placeholder="1500000"
              defaultValue={current?.totalBudget}
              aria-describedby={hintId(`${id}-budget`)}
              className="field nums rounded-l-none"
            />
          </div>
        </Field>

        <Field
          label="Where"
          hint="Cost varies more by city tier than by anything else in India."
          id={`${id}-tier`}
        >
          <select
            id={`${id}-tier`}
            name={FIELD.cityTier}
            required
            defaultValue={current?.cityTier ?? ("tier1" satisfies CityTier)}
            aria-describedby={hintId(`${id}-tier`)}
            className="field"
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
        id={`${id}-city`}
      >
        <input
          id={`${id}-city`}
          type="text"
          name={FIELD.city}
          maxLength={60}
          placeholder="Nagpur"
          defaultValue={current?.city}
          autoComplete="address-level2"
          aria-describedby={hintId(`${id}-city`)}
          className="field"
        />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">
          What you will not compromise on{" "}
          <span className="font-normal text-[var(--text-soft)]">(optional)</span>
        </legend>
        <p className="text-sm text-[var(--text-soft)]">
          These get funded first. The money comes from the other categories, and the plan shows
          you exactly where from.
        </p>
        <div className="mt-0.5 flex flex-wrap gap-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] has-checked:border-[var(--accent)] has-checked:bg-[var(--accent-soft)]"
            >
              <input
                type="checkbox"
                name={FIELD.priorities}
                value={category.id}
                defaultChecked={selected.has(category.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {category.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <button type="submit" className="btn-primary">
          Plan it →
        </button>
      </div>
    </form>
  );
}

/**
 * Label, hint and control.
 *
 * The hint carries `id={hintId(...)}` and every control references it with
 * `aria-describedby`. Without that wiring a screen-reader user hears the label
 * and the input and never the explanation of what the field means — which, for
 * "city tier", is the entire content of the field.
 */
function Field({
  label,
  hint,
  id,
  children,
}: {
  label: string;
  hint: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      <p id={hintId(id)} className="text-xs text-[var(--text-soft)]">
        {hint}
      </p>
    </div>
  );
}

/** One place that derives a hint's id, so a control cannot point at the wrong one. */
function hintId(controlId: string): string {
  return `${controlId}-hint`;
}
