import type { BudgetVerdict, IssueSeverity, TaskStatus } from "@/lib/types";

/**
 * Status badges.
 *
 * Every badge carries three independent signals: a colour, a word and a glyph.
 *
 * That is not belt-and-braces. The festive palette elsewhere on this page is
 * decoration and is allowed to be; these badges are the opposite — they carry
 * the information. A budget table encoded only in red and green is unreadable to
 * roughly one man in twelve, unreadable in the printout, and unreadable read
 * aloud, and the thing being encoded is "you cannot afford this". So the word is
 * always present and always what is announced; the colour is a convenience on
 * top of it.
 *
 * Glyphs are `aria-hidden` so they are not read out as character names.
 */

interface BadgeStyle {
  label: string;
  glyph: string;
  fg: string;
  bg: string;
}

const VERDICT_STYLE: Record<BudgetVerdict, BadgeStyle> = {
  realistic: { label: "Realistic", glyph: "✓", fg: "var(--good)", bg: "var(--good-soft)" },
  tight: { label: "Tight", glyph: "!", fg: "var(--warn)", bg: "var(--warn-soft)" },
  unrealistic: { label: "Not deliverable", glyph: "✕", fg: "var(--bad)", bg: "var(--bad-soft)" },
  generous: { label: "Room to move", glyph: "↑", fg: "var(--cool)", bg: "var(--cool-soft)" },
};

const SEVERITY_STYLE: Record<IssueSeverity, BadgeStyle> = {
  blocker: { label: "Blocker", glyph: "✕", fg: "var(--bad)", bg: "var(--bad-soft)" },
  warning: { label: "Warning", glyph: "!", fg: "var(--warn)", bg: "var(--warn-soft)" },
  note: { label: "Worth knowing", glyph: "i", fg: "var(--cool)", bg: "var(--cool-soft)" },
};

const STATUS_STYLE: Record<TaskStatus, BadgeStyle> = {
  overdue: { label: "Overdue", glyph: "!", fg: "var(--bad)", bg: "var(--bad-soft)" },
  "due-now": { label: "This week", glyph: "◆", fg: "var(--warn)", bg: "var(--warn-soft)" },
  upcoming: { label: "Upcoming", glyph: "○", fg: "var(--text-soft)", bg: "var(--surface-sunken)" },
};

function Badge({ style }: { style: BadgeStyle }) {
  return (
    <span className="pill" style={{ color: style.fg, background: style.bg, borderColor: style.fg }}>
      <span aria-hidden="true">{style.glyph}</span>
      {style.label}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: BudgetVerdict }) {
  return <Badge style={VERDICT_STYLE[verdict]} />;
}

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return <Badge style={SEVERITY_STYLE[severity]} />;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge style={STATUS_STYLE[status]} />;
}

/** The spine dot on the timeline. Decorative: the badge beside it carries the word. */
export function StatusDot({ status, index }: { status: TaskStatus; index: number }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      aria-hidden="true"
      className="spine-dot nums"
      style={{ color: style.fg, background: style.bg }}
    >
      {index}
    </span>
  );
}

export { STATUS_STYLE, VERDICT_STYLE };
