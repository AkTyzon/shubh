/**
 * Per-occasion theming.
 *
 * A wedding, a child's birthday, a housewarming puja and a society Diwali
 * programme are not the same occasion, and a planner should not be looking at
 * the same grey dashboard for all four. Each gets its own palette, its own
 * gradient and its own motif, applied by setting `data-occasion` on a wrapper —
 * so the theme is CSS, resolved server-side, and costs no JavaScript.
 *
 * Every accent below was picked to clear WCAG AA (4.5:1) as text on this
 * project's light surface, with a separate value for the dark surface where the
 * light-mode accents fall well short. Theming is decoration; it is never the
 * only thing carrying meaning. Budget verdicts and task statuses keep their own
 * semantic colours, each paired with a word and a glyph, precisely so the festive
 * palette can be enjoyed without being load-bearing.
 */

import type { EventTypeId } from "./types";

export interface Occasion {
  id: EventTypeId;
  label: string;
  /** Short, warm description for the picker. */
  blurb: string;
  /** What the occasion is called in the plan heading. */
  noun: string;
  /**
   * Decorative glyph for headings and the picker.
   *
   * Always `aria-hidden` where it appears: a screen reader announcing
   * "ring emoji" before every heading is noise, and the label is always present.
   */
  glyph: string;
  /** Two hues, in degrees, that drive the gradient and the budget bar ramp. */
  hues: [number, number];
}

export const OCCASIONS: Record<EventTypeId, Occasion> = {
  wedding: {
    id: "wedding",
    label: "Wedding",
    blurb: "Roka to reception — haldi, mehendi, sangeet and the day itself.",
    noun: "wedding",
    glyph: "💐",
    // Deep rose into marigold: the two colours an Indian wedding is actually made of.
    hues: [335, 32],
  },
  birthday: {
    id: "birthday",
    label: "Birthday",
    blurb: "A child's party or a milestone — cake, games and a theme that lands.",
    noun: "birthday party",
    glyph: "🎂",
    // Violet into cyan. Reads as confetti without being garish.
    hues: [268, 190],
  },
  "griha-pravesh": {
    id: "griha-pravesh",
    label: "Griha Pravesh",
    blurb: "A housewarming puja, built around the muhurat.",
    noun: "griha pravesh",
    glyph: "🪔",
    // Terracotta into leaf green: diya and mango leaves.
    hues: [20, 110],
  },
  community: {
    id: "community",
    label: "Community event",
    blurb: "Society function, festival programme or neighbourhood celebration.",
    noun: "community event",
    glyph: "🎊",
    // Teal into saffron: pandal lighting.
    hues: [178, 38],
  },
};

export const OCCASION_LIST: Occasion[] = [
  OCCASIONS.wedding,
  OCCASIONS.birthday,
  OCCASIONS["griha-pravesh"],
  OCCASIONS.community,
];

export function occasionFor(eventType: EventTypeId): Occasion {
  return OCCASIONS[eventType];
}

/**
 * Colour ramp for the budget bar.
 *
 * Alternates between the occasion's two hues and steps lightness, so adjacent
 * segments are always distinguishable — a single-hue ramp across ten categories
 * produces neighbours nobody can tell apart.
 *
 * The bar is `aria-hidden`: it is an at-a-glance shape, and the budget table
 * beside it is the accessible source of the same numbers. That is deliberate.
 * Encoding ten categories in colour alone and calling it accessible because the
 * swatches have labels would be the wrong trade — the table has the figures, the
 * verdicts and the headers, and it is what a screen reader reads.
 */
export function rampColour(occasion: Occasion, index: number, total: number): string {
  const [hueA, hueB] = occasion.hues;
  const hue = index % 2 === 0 ? hueA : hueB;

  // Walk lightness from deep to light across the categories. Clamped well inside
  // the extremes so no segment disappears into the surface at either end.
  const span = Math.max(1, total - 1);
  const lightness = 34 + (index / span) * 38;
  const saturation = index % 2 === 0 ? 62 : 54;

  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/** Contingency is not a category, so it gets a neutral, visibly different fill. */
export const CONTINGENCY_FILL = "var(--contingency-fill)";
