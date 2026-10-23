/**
 * Decorative artwork.
 *
 * Everything here is ornament. Each piece is `aria-hidden` or carries `alt=""`,
 * none of it encodes information, and deleting the whole file would leave the
 * product working exactly as before. That is the rule the festive layer has to
 * obey to stay compatible with the accessibility one.
 *
 * The large pieces — rangoli, toran, arch, jaali — are generated SVG files in
 * `public/art`, referenced as images so the browser caches them. The small
 * inline pieces live here because they need to pick up the occasion's accent
 * through `currentColor`, which an `<img>` cannot do.
 */

/* eslint-disable @next/next/no-img-element */

/** The rangoli, turning slowly. Used as a background focal piece. */
export function Rangoli({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src="/art/rangoli.svg"
      alt=""
      aria-hidden="true"
      width={600}
      height={600}
      style={style}
      className={`rangoli-spin pointer-events-none select-none ${className}`}
    />
  );
}

/** A hanging toran, tiled across the width of a band. */
export function Toran({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`toran pointer-events-none ${className}`} />;
}

/** A mandap arch, used to frame a section. */
export function Arch({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src="/art/arch.svg"
      alt=""
      aria-hidden="true"
      width={400}
      height={300}
      style={style}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}

/**
 * A diya with a flickering flame.
 *
 * Inline rather than a file so the lamp body takes the occasion's accent while
 * the flame keeps its own warm colour — an `<img>` would be stuck with whatever
 * was baked into it.
 */
export function Diya({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      width={64}
      height={64}
    >
      {/* Flame */}
      <g className="flame">
        <ellipse cx="32" cy="22" rx="6" ry="11" fill="#ffb347" opacity="0.95" />
        <ellipse cx="32" cy="25" rx="3" ry="6.5" fill="#fff3c4" />
      </g>
      {/* Wick */}
      <rect x="31" y="32" width="2" height="5" rx="1" fill="#8a5a2b" />
      {/* Lamp body */}
      <path
        d="M12 38 Q32 34 52 38 Q50 50 32 52 Q14 50 12 38 Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M12 38 Q32 42 52 38" fill="none" stroke="#00000022" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Scattered confetti.
 *
 * Deterministic rather than random: the same shapes in the same places on every
 * render. Random decoration causes a hydration mismatch, and a page that logs
 * React warnings because of its own ornament is not a trade worth making.
 */
export function Confetti({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const pieces = [
    { x: 6, y: 18, r: 24, w: 7, h: 11, o: 0.75 },
    { x: 22, y: 8, r: -18, w: 6, h: 9, o: 0.6 },
    { x: 41, y: 26, r: 52, w: 8, h: 8, o: 0.7 },
    { x: 58, y: 11, r: -40, w: 6, h: 12, o: 0.65 },
    { x: 74, y: 30, r: 16, w: 7, h: 9, o: 0.55 },
    { x: 88, y: 15, r: -28, w: 6, h: 10, o: 0.7 },
    { x: 14, y: 44, r: 62, w: 5, h: 9, o: 0.5 },
    { x: 66, y: 50, r: -12, w: 7, h: 7, o: 0.6 },
  ];
  return (
    <svg
      viewBox="0 0 100 60"
      aria-hidden="true"
      preserveAspectRatio="none"
      style={style}
      className={`pointer-events-none select-none ${className}`}
    >
      {pieces.map((piece, index) => (
        <rect
          key={index}
          x={piece.x}
          y={piece.y}
          width={piece.w}
          height={piece.h}
          rx={1.5}
          transform={`rotate(${piece.r} ${piece.x + piece.w / 2} ${piece.y + piece.h / 2})`}
          fill="currentColor"
          opacity={piece.o}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ mocks */

/**
 * Previews of the real interface, for the feature rows.
 *
 * Built from the same primitives as the product rather than from screenshots:
 * they cannot go stale when the UI changes, they cost nothing to download, they
 * re-theme with the rest of the page, and they stay sharp at any zoom.
 */

export function BudgetMock() {
  const segments = [
    { w: 30, l: 42 },
    { w: 20, l: 50 },
    { w: 14, l: 58 },
    { w: 12, l: 48 },
    { w: 10, l: 64 },
    { w: 14, l: 56 },
  ];
  return (
    <div className="mock p-4">
      <div className="mock-bar" aria-hidden="true">
        {segments.map((segment, index) => (
          <div
            key={index}
            style={{
              width: `${segment.w}%`,
              background: `hsl(var(--glow-${index % 2 === 0 ? "a" : "b"}) 60% ${segment.l}%)`,
            }}
          />
        ))}
      </div>
      <div className="mt-3">
        {[
          ["Catering", "₹6,75,000", "Realistic"],
          ["Venue", "₹4,50,000", "Realistic"],
          ["Decor", "₹3,15,000", "Tight"],
        ].map(([label, amount, verdict]) => (
          <div key={label} className="mock-row">
            <span className="flex-1 font-semibold">{label}</span>
            <span className="nums text-[var(--text-soft)]">{amount}</span>
            <span
              className="pill"
              style={
                verdict === "Tight"
                  ? { color: "var(--warn)", background: "var(--warn-soft)", borderColor: "var(--warn)" }
                  : { color: "var(--good)", background: "var(--good-soft)", borderColor: "var(--good)" }
              }
            >
              {verdict}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
        <span className="font-semibold">Allocated + contingency</span>
        <span className="nums font-bold">= ₹25,00,000 exactly</span>
      </div>
    </div>
  );
}

export function TimelineMock() {
  const rows = [
    ["Book the venue", "180 days before", "overdue"],
    ["Fix the menu and headcount", "90 days before", "due"],
    ["Confirm the photographer", "60 days before", "ok"],
    ["Final headcount to caterer", "14 days before", "ok"],
  ] as const;

  const tone = (status: string) =>
    status === "overdue"
      ? { color: "var(--bad)", background: "var(--bad-soft)" }
      : status === "due"
        ? { color: "var(--warn)", background: "var(--warn-soft)" }
        : { color: "var(--text-soft)", background: "var(--surface-sunken)" };

  return (
    <div className="mock p-4">
      <ol className="spine grid gap-2.5">
        {rows.map(([label, when, status], index) => (
          <li key={label} className="relative">
            <span className="spine-dot nums" aria-hidden="true" style={tone(status)}>
              {index + 1}
            </span>
            <div className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
              <p className="text-xs font-semibold">{label}</p>
              <p className="nums text-[0.7rem] text-[var(--text-soft)]">{when}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ChecklistMock() {
  return (
    <div className="mock p-4">
      <p className="text-xs font-bold tracking-widest uppercase text-[var(--accent)]">
        Caterer · paid from catering
      </p>
      <ul className="mt-2 grid gap-1.5 text-xs">
        {[
          "What is the per-plate rate, and at what headcount does it change?",
          "How many service counters, for this guest count?",
          "Is there a tasting before I confirm?",
        ].map((question) => (
          <li key={question} className="flex gap-2">
            <span aria-hidden="true" className="text-[var(--accent)]">
              ?
            </span>
            <span>{question}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-bold tracking-widest uppercase" style={{ color: "var(--bad)" }}>
        Red flag
      </p>
      <p className="mt-1 text-xs text-[var(--text-soft)]">
        A quote with no headcount written on it. It is not a quote.
      </p>
    </div>
  );
}

export function VerifiedMock() {
  return (
    <div className="mock p-4">
      <p className="text-xs leading-relaxed">
        Catering comes to <strong className="nums">₹6,75,000</strong>, and you should set aside{" "}
        <del className="nums" style={{ color: "var(--bad)" }}>
          ₹47,312
        </del>{" "}
        <span className="font-bold" style={{ color: "var(--bad)" }}>
          ⚠ not in the plan
        </span>{" "}
        for the pandit.
      </p>
      <div
        className="mt-3 rounded-lg border p-2.5"
        style={{ borderColor: "var(--bad)", background: "var(--bad-soft)" }}
      >
        <p className="text-xs font-semibold">
          <span aria-hidden="true">⚠ </span>1 of 2 figures did not match
        </p>
        <p className="mt-0.5 text-[0.7rem] text-[var(--text-soft)]">
          ₹47,312 does not appear anywhere in your computed plan.
        </p>
      </div>
    </div>
  );
}
