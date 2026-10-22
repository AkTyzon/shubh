/**
 * Plan input as URL state.
 *
 * The whole plan lives in the query string, which buys two things that are
 * usually treated as afterthoughts:
 *
 * 1. **The product works with JavaScript disabled.** The form is a plain GET
 *    form, the page reads these parameters on the server, and the budget,
 *    schedule and feasibility findings are rendered in the HTML response. No
 *    client bundle is required to use the thing. Only the AI narrative — which
 *    genuinely cannot work without a network call — is a client island.
 *
 * 2. **A plan is a link.** Wedding budgets are argued over by families, not
 *    decided by one person at a laptop. Being able to send the exact plan to
 *    someone is more useful than any amount of in-app collaboration.
 *
 * Short parameter names keep the shared link readable at a glance rather than
 * looking like a tracking URL.
 */

import type { PlanInput } from "./types";

const KEYS = {
  eventType: "e",
  eventDate: "d",
  guestCount: "g",
  cityTier: "t",
  city: "c",
  totalBudget: "b",
  priorities: "p",
  today: "n",
} as const;

export type RawPlanParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Pull raw strings out of search params for `parsePlanInput` to validate.
 *
 * Deliberately does no validation itself. One validator, in `lib/plan.ts`,
 * covering both the JSON API and the URL — two would drift, and the drift would
 * be a difference in what each surface accepts.
 */
export function readPlanParams(params: RawPlanParams): Record<string, unknown> | null {
  const eventType = first(params[KEYS.eventType]);
  const eventDate = first(params[KEYS.eventDate]);
  const guestCount = first(params[KEYS.guestCount]);
  const totalBudget = first(params[KEYS.totalBudget]);
  const cityTier = first(params[KEYS.cityTier]);

  // Nothing to render unless the essentials are all present. A half-filled URL
  // shows the empty form rather than an error, because the usual way to get one
  // is an incompletely copied link.
  if (!eventType || !eventDate || !guestCount || !totalBudget || !cityTier) return null;

  const priorities = params[KEYS.priorities];

  return {
    eventType,
    eventDate,
    guestCount,
    totalBudget,
    cityTier,
    city: first(params[KEYS.city]),
    priorities: Array.isArray(priorities)
      ? priorities
      : priorities
        ? priorities.split(",").filter(Boolean)
        : [],
    today: first(params[KEYS.today]),
  };
}

/** Build a shareable query string from a validated input. */
export function planToQuery(input: PlanInput): string {
  const params = new URLSearchParams({
    [KEYS.eventType]: input.eventType,
    [KEYS.eventDate]: input.eventDate,
    [KEYS.guestCount]: String(input.guestCount),
    [KEYS.cityTier]: input.cityTier,
    [KEYS.totalBudget]: String(input.totalBudget),
  });
  if (input.city) params.set(KEYS.city, input.city);
  if (input.priorities?.length) params.set(KEYS.priorities, input.priorities.join(","));
  return params.toString();
}

/** Field names for the GET form, so the form and the reader cannot disagree. */
export const FIELD = KEYS;
