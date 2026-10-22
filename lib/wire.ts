/**
 * The API contract between the routes and the browser.
 *
 * Kept in one module so the server and the client cannot drift apart on the
 * stream format — a mismatch there is invisible until a user sees a raw sentinel
 * string in the middle of their plan.
 */

import type { Plan, PlanInput } from "./types";
import type { VerificationResult } from "./verify";

export interface PlanResponse {
  plan: Plan;
  /** Label of the configured model, or null when none is. Shown in the footer. */
  provider: string | null;
  /** True when inference runs on the serving machine and nothing leaves it. */
  onDevice: boolean;
}

export interface IdeasRequest {
  /** Raw input. The server recomputes the plan from this rather than trusting a
   *  client-supplied one, so the verification allow-list cannot be widened by
   *  editing a request body. */
  input: PlanInput;
  /** Optional follow-up question about the plan. Omit for the full narrative. */
  question?: string;
}

/**
 * Separates the narrative from its verification result in the response stream.
 *
 * The text is streamed as it is generated, then this marker, then one line of
 * JSON. Verification needs the whole text — a figure can be split across chunks
 * — so it cannot be interleaved.
 *
 * The consequence is deliberate and visible in the UI: text appears before it
 * has been checked, so it is rendered in a clearly marked unverified state until
 * the verification arrives. Hiding the output until the check completed would be
 * the alternative, and it would make a ten-second generation feel broken.
 *
 * The sentinel is chosen to be something a model will not produce on its own.
 */
export const VERIFICATION_MARKER = "\n␞::shubh-verification::\n";

export interface VerificationEnvelope {
  verification: VerificationResult;
  /** Which model produced the text, or "deterministic" for the no-key fallback. */
  source: string;
  /** True when the text came from the built-in narrative rather than a model. */
  deterministic: boolean;
}

/**
 * Split a response body into narrative and verification.
 *
 * Called repeatedly on a growing buffer while the response streams, so it has to
 * be correct on every partial state — not just on the complete body.
 *
 * The subtle case is a *partially arrived* marker. The sentinel begins with a
 * newline, so a buffer that ends mid-marker would otherwise render the fragment
 * as narrative text and briefly flash `\n␞::shubh-ver` on screen before the rest
 * arrived. Any trailing run that could still become the marker is therefore held
 * back until the next chunk resolves it.
 */
export function splitStreamPayload(body: string): {
  text: string;
  envelope?: VerificationEnvelope;
} {
  const index = body.indexOf(VERIFICATION_MARKER);
  if (index === -1) return { text: body.slice(0, body.length - partialMarkerLength(body)) };

  const text = body.slice(0, index);
  const tail = body.slice(index + VERIFICATION_MARKER.length).trim();
  if (!tail) return { text };

  try {
    return { text, envelope: JSON.parse(tail) as VerificationEnvelope };
  } catch {
    // A truncated tail means the envelope is still arriving, or the connection
    // dropped mid-envelope. Either way the narrative is worth showing; the UI
    // reports it as unverified until an envelope parses.
    return { text };
  }
}

/**
 * Length of the trailing run of `body` that could still grow into the marker.
 *
 * Returns 0 when the end of the buffer cannot be the start of a marker, which is
 * the overwhelmingly common case.
 */
function partialMarkerLength(body: string): number {
  const most = Math.min(VERIFICATION_MARKER.length - 1, body.length);
  for (let length = most; length > 0; length -= 1) {
    if (VERIFICATION_MARKER.startsWith(body.slice(body.length - length))) return length;
  }
  return 0;
}
