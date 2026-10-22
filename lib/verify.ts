/**
 * Output verification.
 *
 * The check that makes the rest of the product trustworthy, and the direct
 * reason this is not a chat window with a nice theme.
 *
 * The model is handed a plan that is already computed and asked to explain and
 * personalise it. That is a narrow job, and it still goes wrong in a specific,
 * dangerous way: models round, restate and embellish numbers. "About ₹7 lakh for
 * catering" when the allocation is ₹6,75,000. "You'll want roughly ₹50,000 for
 * the pandit" when nothing in the plan says that. Each sounds authoritative and
 * each is a number the reader may act on.
 *
 * So every rupee figure and every date in the model's output is extracted and
 * checked against the plan:
 *
 * - **Matched** — the figure appears in the plan. Safe to show.
 * - **Rounded** — within a small tolerance of a real figure. Flagged with the
 *   exact value, because "about ₹7 lakh" is how a ₹25,000 error enters a budget.
 * - **Invented** — matches nothing. Shown struck through with a warning.
 *
 * Dates are checked the same way against the computed schedule.
 *
 * **A second limitation.** The allow-list includes figures the product derives
 * and displays in prose -- a shortfall, a per-plate rate -- because a reader
 * quoting what the page showed them must not be flagged. That makes the list
 * denser, and a denser list is a weaker check: more wrong values land within the
 * rounding tolerance of something real. The alternative is worse, and the density
 * is measured by a test rather than assumed to be acceptable.
 *
 * **A limitation worth stating.** The allow-list is a set of values, not of
 * meanings. A figure that coincidentally equals a real plan figure passes even
 * if the model attached it to the wrong thing -- \"₹2,00,000 for the elephant\"
 * matches because ₹2,00,000 happens to be the metro venue floor. The check
 * catches invention, not misattribution. Closing that gap needs the model to
 * emit structured references rather than prose, which is the obvious next step
 * and is not claimed here.
 *
 * The UI shows the tally. An explanation where every figure checks out reads
 * very differently from one where two were invented, and the reader is the
 * person who needs to know which they are looking at.
 */

import type { IsoDate, Money, Plan } from "./types";

export type FigureStatus = "matched" | "rounded" | "invented";

export interface FigureCheck {
  /** The text as the model wrote it, e.g. "₹6.75 lakh". */
  raw: string;
  /** Parsed rupee value. */
  value: Money;
  status: FigureStatus;
  /** The plan figure this was matched against, when it matched. */
  matched?: Money;
  /** Shown beside the figure when it is not an exact match. */
  note?: string;
}

export interface DateCheck {
  raw: string;
  iso: IsoDate;
  status: "matched" | "invented";
  note?: string;
}

export interface VerificationResult {
  figures: FigureCheck[];
  dates: DateCheck[];
  matched: number;
  /** Rounded plus invented: everything a reader should not take at face value. */
  flagged: number;
  /** True when the text quoted no figures at all, which is itself worth saying. */
  unquantified: boolean;
}

/**
 * How far from a plan figure still counts as "rounded" rather than invented.
 *
 * Two per cent, floored at ₹500. A model writing "about ₹6.7 lakh" for ₹6,75,000
 * is rounding; one writing ₹9,00,000 is not. Reporting a round number as
 * invented would cry wolf; accepting a genuinely wrong one would defeat the
 * check.
 */
const ROUNDING_TOLERANCE = 0.02;
const MIN_TOLERANCE = 500;

/**
 * Hard relative ceiling on what "rounded" can mean.
 *
 * The ₹500 floor above exists so that small figures are still catchable as
 * rounded -- ₹8,000 for ₹8,333 is a rounding, and 2% of ₹8,333 is only ₹167. But
 * an absolute floor dominates genuinely small figures: with the floor alone,
 * ₹1 sits within ₹500 of a real ₹375 per-guest rate and was reported as a
 * rounding of it, which is nonsense. Nobody rounds 375 to 1.
 *
 * So a figure must also be within a quarter of the real one. Rounding is a small
 * relative change by definition; anything beyond this is a different number.
 */
const MAX_RELATIVE_DRIFT = 0.25;

/**
 * Rupee amounts as they appear in generated prose.
 *
 * Covers the forms that actually show up: ₹6,75,000 with Indian grouping,
 * ₹6.75 lakh, ₹1.2 crore, "Rs 50,000", and bare "75,000" following a currency
 * word. Deliberately does not match bare integers without a currency marker --
 * guest counts and day counts are numbers too, and flagging those would make the
 * panel useless.
 */
const FIGURE_PATTERN =
  /(?:₹|Rs\.?\s?|INR\s?)\s*([\d,]+(?:\.\d+)?)\s*(crore|cr\b|lakh|lac\b|lakhs|k\b)?/gi;

const MULTIPLIERS: Record<string, number> = {
  crore: 10_000_000,
  cr: 10_000_000,
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  k: 1_000,
};

/** ISO dates and `14 Feb 2027` / `14 February 2027` forms. */
const ISO_DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/g;
const LONG_DATE_PATTERN =
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})\b/gi;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Every rupee amount in a block of text, in the order written.
 *
 * Exported because two callers need to agree exactly on what counts as a figure:
 * this module, when checking model output, and `lib/plan.ts`, when collecting
 * the allow-list from the text the product itself displays. Two extractors would
 * drift, and the drift would present as the product flagging its own numbers.
 */
export function extractFigures(text: string): { raw: string; value: Money }[] {
  const found: { raw: string; value: Money }[] = [];
  FIGURE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FIGURE_PATTERN.exec(text)) !== null) {
    const value = parseFigure(match[1]!, match[2]);
    if (!Number.isFinite(value) || value <= 0) continue;
    found.push({ raw: match[0].trim(), value });
  }
  return found;
}

export function parseFigure(digits: string, unit: string | undefined): Money {
  const base = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(base)) return Number.NaN;
  const multiplier = unit ? (MULTIPLIERS[unit.toLowerCase().replace(/\./g, "")] ?? 1) : 1;
  return Math.round(base * multiplier);
}

/** Check one amount against the plan's allow-list. */
export function checkFigure(value: Money, allowed: Money[]): FigureCheck["status"] {
  if (allowed.includes(value)) return "matched";
  return allowed.some((figure) => isRoundingOf(value, figure)) ? "rounded" : "invented";
}

/** Whether `value` is plausibly a rounded rendering of `figure`. */
function isRoundingOf(value: Money, figure: Money): boolean {
  const drift = Math.abs(figure - value);
  // Tolerance is computed against the plan's figure, not the model's: the
  // reference point has to be the number we know is real.
  return (
    drift <= Math.max(MIN_TOLERANCE, figure * ROUNDING_TOLERANCE) &&
    drift <= figure * MAX_RELATIVE_DRIFT
  );
}

/**
 * The closest plan figure that `value` could be a rounding of.
 *
 * Restricted to candidates that actually pass `isRoundingOf`, so the "the
 * computed figure is X" note can never point at something the check itself would
 * not accept.
 */
function nearest(value: Money, allowed: Money[]): Money | undefined {
  let best: Money | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const figure of allowed) {
    if (!isRoundingOf(value, figure)) continue;
    const distance = Math.abs(figure - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = figure;
    }
  }
  return best;
}

/** Verify a block of generated text against a computed plan. */
export function verifyAgainstPlan(text: string, plan: Plan): VerificationResult {
  const allowed = plan.verifiedFigures;
  const figures: FigureCheck[] = [];
  const seenFigures = new Set<string>();

  for (const { raw, value } of extractFigures(text)) {
    // De-duplicate on value: the same amount restated is one claim, not several.
    const key = String(value);
    if (seenFigures.has(key)) continue;
    seenFigures.add(key);

    const status = checkFigure(value, allowed);
    const near = status === "rounded" ? nearest(value, allowed) : undefined;

    figures.push({
      raw,
      value,
      status,
      matched: status === "matched" ? value : near,
      note:
        status === "rounded" && near !== undefined
          ? `Rounded. The computed figure is ₹${near.toLocaleString("en-IN")}.`
          : status === "invented"
            ? "This figure does not appear anywhere in your computed plan."
            : undefined,
    });
  }

  const allowedDates = new Set(plan.timeline.tasks.map((task) => task.dueDate));
  allowedDates.add(plan.input.eventDate);

  const dates: DateCheck[] = [];
  const seenDates = new Set<string>();

  const record = (raw: string, iso: IsoDate) => {
    if (seenDates.has(iso)) return;
    seenDates.add(iso);
    const ok = allowedDates.has(iso);
    dates.push({
      raw,
      iso,
      status: ok ? "matched" : "invented",
      note: ok ? undefined : "This date is not in your computed schedule.",
    });
  };

  let match: RegExpExecArray | null;
  ISO_DATE_PATTERN.lastIndex = 0;
  while ((match = ISO_DATE_PATTERN.exec(text)) !== null) record(match[0], match[1]!);

  LONG_DATE_PATTERN.lastIndex = 0;
  while ((match = LONG_DATE_PATTERN.exec(text)) !== null) {
    const month = MONTHS[match[2]!.slice(0, 3).toLowerCase()];
    if (!month) continue;
    record(match[0], `${match[3]}-${month}-${match[1]!.padStart(2, "0")}`);
  }

  const matched =
    figures.filter((f) => f.status === "matched").length +
    dates.filter((d) => d.status === "matched").length;
  const flagged = figures.length + dates.length - matched;

  return { figures, dates, matched, flagged, unquantified: figures.length === 0 };
}
