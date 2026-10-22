"use client";

/**
 * Print and share.
 *
 * Both are progressive enhancements over things the browser already does: the
 * print path is `@media print` rules in `globals.css`, and the share path is the
 * URL itself. If this component never loads, the plan is still printable from
 * the browser menu and still shareable by copying the address bar — which is why
 * these are buttons here rather than the mechanism.
 *
 * The copy button reports its result in text, not only by changing colour, and
 * falls back to selecting the URL when the clipboard API is unavailable — it is
 * absent over plain HTTP and blocked in some in-app browsers, both of which are
 * common for this audience.
 */

import { useEffect, useRef, useState } from "react";

export function PlanActions() {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied("idle"), 4000);
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-sunken)]"
      >
        Copy link to this plan
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-sunken)]"
      >
        Print or save as PDF
      </button>
      {/* Announced when it changes, and readable as text rather than inferred
          from a colour change. */}
      <p aria-live="polite" className="text-sm text-[var(--text-soft)]">
        {copied === "done"
          ? "Link copied. Anyone you send it to sees this exact plan."
          : copied === "failed"
            ? "Could not copy automatically — copy the address bar instead."
            : ""}
      </p>
    </div>
  );
}
