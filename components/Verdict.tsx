import type { BudgetVerdict, IssueSeverity } from "@/lib/types";

/**
 * Status badges.
 *
 * Every badge carries three independent signals: a colour, a word and a glyph.
 *
 * That is not belt-and-braces. A budget table encoded only in red and green is
 * unreadable to roughly one man in twelve, unreadable in a printout, and
 * unreadable to a screen reader — and the information being encoded is "you
 * cannot afford this", which is the most important thing on the page. So the
 * word is always present and always the thing read aloud; the colour is
 * decoration on top of it.
 *
 * The glyph is `aria-hidden` so it is not announced as a character name.
 */

const VERDICT_STYLE: Record<BudgetVerdict, { label: string; glyph: string; className: string }> = {
  realistic: {
    label: "Realistic",
    glyph: "✓",
    className: "text-[var(--color-good)] bg-[var(--color-good-soft)] border-[var(--color-good)]",
  },
  tight: {
    label: "Tight",
    glyph: "!",
    className: "text-[var(--color-warn)] bg-[var(--color-warn-soft)] border-[var(--color-warn)]",
  },
  unrealistic: {
    label: "Not deliverable",
    glyph: "✕",
    className: "text-[var(--color-bad)] bg-[var(--color-bad-soft)] border-[var(--color-bad)]",
  },
  generous: {
    label: "Room to move",
    glyph: "↑",
    className: "text-[var(--color-cool)] bg-[var(--color-cool-soft)] border-[var(--color-cool)]",
  },
};

export function VerdictBadge({ verdict }: { verdict: BudgetVerdict }) {
  const style = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${style.className}`}
    >
      <span aria-hidden="true">{style.glyph}</span>
      {style.label}
    </span>
  );
}

const SEVERITY_STYLE: Record<IssueSeverity, { label: string; glyph: string; className: string }> = {
  blocker: {
    label: "Blocker",
    glyph: "✕",
    className: "text-[var(--color-bad)] bg-[var(--color-bad-soft)] border-[var(--color-bad)]",
  },
  warning: {
    label: "Warning",
    glyph: "!",
    className: "text-[var(--color-warn)] bg-[var(--color-warn-soft)] border-[var(--color-warn)]",
  },
  note: {
    label: "Worth knowing",
    glyph: "i",
    className: "text-[var(--color-cool)] bg-[var(--color-cool-soft)] border-[var(--color-cool)]",
  },
};

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const style = SEVERITY_STYLE[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${style.className}`}
    >
      <span aria-hidden="true">{style.glyph}</span>
      {style.label}
    </span>
  );
}

export { VERDICT_STYLE, SEVERITY_STYLE };
