"use client";

/**
 * The AI layer, and the only part of this page that needs JavaScript.
 *
 * Everything above it — budget, schedule, feasibility — is server-rendered from
 * the query string and works with scripting disabled. This component adds the
 * explanation and the personalised ideas on top, and it adds the one thing that
 * makes model output usable for financial decisions: **the output is checked
 * against the computed plan and the result is shown to the reader.**
 *
 * The streaming order is honest about itself. Text arrives before it can be
 * verified — a rupee figure can be split across two network chunks, so the check
 * needs the complete text — so while it streams it is labelled unverified, and
 * the verification panel appears when the envelope arrives. The alternative,
 * buffering everything and showing nothing for ten seconds, reads as broken.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GEMINI_KEY_HEADER } from "@/lib/byo-key";
import type { PlanInput } from "@/lib/types";
import { splitStreamPayload, type VerificationEnvelope } from "@/lib/wire";

type Phase = "idle" | "streaming" | "done" | "error";

export function Narrative({ input, providerLabel }: { input: PlanInput; providerLabel: string | null }) {
  const [text, setText] = useState("");
  const [envelope, setEnvelope] = useState<VerificationEnvelope | undefined>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [apiKey, setApiKey] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  // Abandon an in-flight request when the component goes away, so a navigation
  // mid-stream does not leave a reader attached to a dead response.
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (followUp?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPhase("streaming");
      setError(null);
      setEnvelope(undefined);
      setText("");

      try {
        const response = await fetch("/api/ideas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Sent only when the visitor supplied one. Held in component state
            // and never written to localStorage or sessionStorage: a key in
            // browser storage outlives the session and the visitor's attention.
            ...(apiKey.trim() ? { [GEMINI_KEY_HEADER]: apiKey.trim() } : {}),
          },
          body: JSON.stringify({ input, question: followUp }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "Could not reach the explanation service.",
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // The envelope is appended after a sentinel, so everything before the
          // sentinel is narrative and only the tail needs parsing.
          const split = splitStreamPayload(buffer);
          setText(split.text);
          if (split.envelope) setEnvelope(split.envelope);
        }

        const final = splitStreamPayload(buffer);
        setText(final.text);
        setEnvelope(final.envelope);
        setPhase("done");
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Something went wrong.");
        setPhase("error");
      }
    },
    [apiKey, input],
  );

  const annotated = envelope ? annotate(text, envelope) : text;
  const busy = phase === "streaming";

  return (
    <section aria-labelledby="narrative-heading" className="grid gap-4">
      <div>
        <h2 id="narrative-heading" className="font-serif text-2xl font-semibold">
          The explanation
        </h2>
        <p className="mt-1 text-[var(--text-soft)]">
          The plan above is already final. This part explains it and suggests ideas that fit it —
          and every rupee figure and date it states is checked against the computed plan before
          you are shown it.{" "}
          {providerLabel
            ? `Running on ${providerLabel}.`
            : "No model is configured on this deployment, so the built-in explanation is used — which is itself computed from the plan."}
        </p>
      </div>

      {phase === "idle" ? (
        <div className="grid gap-3 rounded-xl border bg-[var(--surface-raised)] p-5">
          <button
            type="button"
            onClick={() => void run()}
            className="justify-self-start rounded-lg bg-[var(--accent)] px-5 py-2.5 font-semibold text-[var(--accent-contrast)] hover:opacity-90"
          >
            Explain this plan
          </button>
          <KeyField value={apiKey} onChange={setApiKey} />
        </div>
      ) : (
        <div className="grid gap-4">
          <div
            className={`rounded-xl border p-5 ${
              busy
                ? "border-dashed border-[var(--color-warn)] bg-[var(--color-warn-soft)]"
                : "bg-[var(--surface-raised)]"
            }`}
          >
            {/* Announced once, politely: a live region updating on every token
                would make a screen reader unusable. */}
            <p aria-live="polite" className="sr-only">
              {busy
                ? "Generating the explanation. It is not yet verified."
                : envelope
                  ? `Explanation complete. ${envelope.verification.matched} figures matched the plan, ${envelope.verification.flagged} flagged.`
                  : "Explanation complete, but it could not be verified."}
            </p>

            <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              {busy ? (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-warn)]"
                  />
                  <span className="text-[var(--color-warn)]">Generating — not yet verified</span>
                </>
              ) : envelope ? (
                <span className="text-[var(--text-soft)]">
                  {envelope.deterministic ? "Built-in explanation" : `From ${envelope.source}`} ·
                  verified against the computed plan
                </span>
              ) : (
                <span className="text-[var(--color-warn)]">Unverified — the check did not run</span>
              )}
            </p>

            <div className="prose-shubh">
              {annotated ? (
                <Markdown remarkPlugins={[remarkGfm]}>{annotated}</Markdown>
              ) : (
                <p className="text-[var(--text-soft)]">Waiting for the first words…</p>
              )}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--color-bad)] bg-[var(--color-bad-soft)] p-3 text-sm"
            >
              {error}
            </p>
          )}

          {envelope && <VerificationPanel envelope={envelope} />}

          <form
            className="no-print grid gap-2 rounded-xl border bg-[var(--surface-raised)] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (question.trim() && !busy) void run(question);
            }}
          >
            <label htmlFor="follow-up" className="text-sm font-semibold">
              Ask something about this plan
            </label>
            <p id="follow-up-hint" className="text-xs text-[var(--text-soft)]">
              Answers are checked the same way. If the answer needs a figure the plan does not
              contain, it will say so rather than estimate one.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                id="follow-up"
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={600}
                aria-describedby="follow-up-hint"
                placeholder="Can I cut the decor and add to catering?"
                className="min-w-0 flex-1 rounded-lg border bg-[var(--surface)] px-3 py-2"
              />
              <button
                type="submit"
                disabled={busy || !question.trim()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-contrast)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Working…" : "Ask"}
              </button>
            </div>
          </form>

          <div className="no-print">
            <KeyField value={apiKey} onChange={setApiKey} />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The verification result.
 *
 * The tally leads, because "every figure checked out" and "two figures were
 * invented" are the two things a reader needs to be able to tell apart at a
 * glance, and they are not distinguishable from the prose itself.
 */
function VerificationPanel({ envelope }: { envelope: VerificationEnvelope }) {
  const { verification } = envelope;
  const clean = verification.flagged === 0;
  const nothingToCheck = verification.figures.length === 0 && verification.dates.length === 0;

  return (
    <section
      aria-labelledby="verification-heading"
      className={`rounded-xl border p-4 ${
        nothingToCheck
          ? "bg-[var(--surface-sunken)]"
          : clean
            ? "border-[var(--color-good)] bg-[var(--color-good-soft)]"
            : "border-[var(--color-bad)] bg-[var(--color-bad-soft)]"
      }`}
    >
      <h3 id="verification-heading" className="font-semibold">
        <span aria-hidden="true">{nothingToCheck ? "— " : clean ? "✓ " : "⚠ "}</span>
        {nothingToCheck
          ? "No figures or dates were quoted"
          : clean
            ? `All ${verification.matched} figures and dates match the computed plan`
            : `${verification.flagged} of ${verification.figures.length + verification.dates.length} figures and dates did not match`}
      </h3>

      <p className="mt-1 text-sm">
        {nothingToCheck
          ? "The explanation stated no rupee amounts or dates of its own, so there was nothing to check against the plan."
          : clean
            ? "Each one was extracted from the text and found in your plan. Nothing above was invented."
            : "Figures that do not appear in your computed plan are struck through in the text above. Treat them as unreliable — the plan's own numbers are the ones in the table."}
      </p>

      {(verification.figures.length > 0 || verification.dates.length > 0) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Show every figure that was checked
          </summary>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {verification.figures.map((figure) => (
              <li key={`f-${figure.value}`} className="flex flex-wrap items-baseline gap-2">
                <code className="nums rounded bg-[var(--surface-sunken)] px-1.5 py-0.5">
                  {figure.raw}
                </code>
                <span
                  className={
                    figure.status === "matched"
                      ? "text-[var(--color-good)]"
                      : figure.status === "rounded"
                        ? "text-[var(--color-warn)]"
                        : "text-[var(--color-bad)]"
                  }
                >
                  {figure.status === "matched"
                    ? "matches the plan"
                    : figure.status === "rounded"
                      ? "rounded"
                      : "not in the plan"}
                </span>
                {figure.note && (
                  <span className="text-[var(--text-soft)]">{figure.note}</span>
                )}
              </li>
            ))}
            {verification.dates.map((date) => (
              <li key={`d-${date.iso}`} className="flex flex-wrap items-baseline gap-2">
                <code className="nums rounded bg-[var(--surface-sunken)] px-1.5 py-0.5">
                  {date.raw}
                </code>
                <span
                  className={
                    date.status === "matched" ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"
                  }
                >
                  {date.status === "matched" ? "in the schedule" : "not in the schedule"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** The bring-your-own-key field, collapsed by default. */
function KeyField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <details className="no-print text-sm">
      <summary className="cursor-pointer text-[var(--text-soft)]">
        Use your own Gemini API key
      </summary>
      <div className="mt-2 grid gap-1.5">
        <label htmlFor="byo-key" className="font-semibold">
          Gemini API key
        </label>
        <input
          id="byo-key"
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="byo-key-hint"
          placeholder="AIza… or AQ.…"
          className="w-full rounded-lg border bg-[var(--surface)] px-3 py-2 font-mono"
        />
        <p id="byo-key-hint" className="text-xs text-[var(--text-soft)]">
          Sent as a request header for this one call, used once, and never stored — not in this
          page&apos;s memory beyond the session, not in browser storage, not in a log. Leave it
          empty to use whatever the deployment has configured.
        </p>
      </div>
    </details>
  );
}

/**
 * Mark flagged figures inside the narrative itself.
 *
 * A panel below the text is not enough: someone reading the explanation will act
 * on a figure in the sentence they are reading. So an invented figure is struck
 * through where it appears, and a rounded one is followed by the exact value.
 *
 * Done on the markdown source, before rendering, using `remark-gfm`'s
 * strikethrough. Note what this is *not*: it is not an HTML injection, because
 * `react-markdown` builds React elements rather than setting `innerHTML`, so the
 * worst a hostile model could achieve here is odd-looking text.
 */
function annotate(text: string, envelope: VerificationEnvelope): string {
  let output = text;

  // Longest raw string first. "₹4.44 lakh" and "₹4.44" can both be flagged, and
  // replacing the shorter one first would rewrite the inside of the annotation
  // the longer one had already inserted.
  const flagged = envelope.verification.figures
    .filter((figure) => figure.status !== "matched")
    .sort((a, b) => b.raw.length - a.raw.length);

  for (const figure of flagged) {
    const replacement =
      figure.status === "invented"
        ? `~~${figure.raw}~~ **⚠ not in the plan**`
        : `${figure.raw} **(exact: ₹${figure.matched?.toLocaleString("en-IN")})**`;
    output = replaceLiteral(output, figure.raw, replacement);
  }

  for (const date of envelope.verification.dates) {
    if (date.status === "matched") continue;
    output = replaceLiteral(output, date.raw, `~~${date.raw}~~ **⚠ not in the schedule**`);
  }

  return output;
}

/**
 * Literal string replace.
 *
 * Split-and-join rather than `replaceAll`, because `replaceAll` interprets `$&`
 * and `$1` in the *replacement* as substitutions — and a replacement built from
 * model output is exactly where that would surprise someone.
 */
function replaceLiteral(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}
