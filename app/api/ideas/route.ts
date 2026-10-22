/**
 * POST /api/ideas — the narrative, verified.
 *
 * The plan is already computed by the time anything reaches a model here. This
 * route re-derives it from the raw input, hands it to the model as read-only
 * context, streams the explanation back, and then checks every figure and date
 * the model wrote against the plan before the request ends.
 *
 * Three decisions worth stating:
 *
 * 1. **The plan is recomputed server-side**, never accepted from the client. The
 *    verification allow-list is derived from the plan, so trusting a posted plan
 *    would let a caller widen the allow-list and have invented figures pass.
 *
 * 2. **Failure degrades to content, not to an error.** No API key, exhausted
 *    quota, provider outage -- all of them fall through to the deterministic
 *    narrative in `lib/narrative.ts`, which is built from the plan and passes
 *    verification by construction. A cloned repo with no credentials is fully
 *    functional.
 *
 * 3. **Verification is appended, not interleaved.** A rupee figure can be split
 *    across two network chunks, so the check needs the complete text. The
 *    consequence is that text reaches the screen before it has been checked, and
 *    the UI marks it as unverified until the envelope arrives rather than
 *    pretending otherwise.
 */

import { readKeyOverride } from "@/lib/byo-key";
import { ProviderError, resolveProvider, streamCompletion } from "@/lib/llm";
import { buildNarrative } from "@/lib/narrative";
import { buildPlan, parsePlanInput, planAsContext, PlanInputError } from "@/lib/plan";
import { buildPlanNarrativePrompt, buildQuestionPrompt, buildUserPrompt } from "@/lib/prompt";
import { clientKey, RateLimiter } from "@/lib/rate-limit";
import type { Plan } from "@/lib/types";
import { verifyAgainstPlan } from "@/lib/verify";
import { VERIFICATION_MARKER, type VerificationEnvelope } from "@/lib/wire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel's Hobby plan caps a function at 60 seconds.
 *
 * The streaming path sends its first bytes long before this, so the ceiling only
 * matters for a very slow generation -- and the idle watchdog in `lib/llm.ts`
 * kills a genuinely hung stream well inside it.
 */
export const maxDuration = 60;

/** Tight, because each call spends model quota that is shared by every visitor. */
const limiter = new RateLimiter(12, 5 * 60_000);

/** Longest follow-up question accepted. Past this it is not a question. */
const MAX_QUESTION_LENGTH = 600;

export async function POST(request: Request): Promise<Response> {
  const limit = limiter.check(clientKey(request));
  if (!limit.allowed) {
    return Response.json(
      {
        error:
          "You have used this deployment's share of model requests for now. " +
          "The plan itself is unaffected — it is computed without a model.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  limiter.sweep();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  let plan: Plan;
  try {
    plan = buildPlan(parsePlanInput(body.input));
  } catch (error) {
    if (error instanceof PlanInputError) {
      return Response.json({ error: error.message, field: error.field }, { status: 400 });
    }
    console.error("[ideas] plan construction failed", error);
    return Response.json({ error: "Could not compute a plan for that input." }, { status: 500 });
  }

  const question =
    typeof body.question === "string" && body.question.trim()
      ? body.question.trim().slice(0, MAX_QUESTION_LENGTH)
      : undefined;

  const provider = resolveProvider(process.env, readKeyOverride(request));

  if (!provider) {
    return deterministicResponse(
      plan,
      question
        ? `*No model is configured on this deployment, so follow-up questions are not available. ` +
            `Your computed plan and the explanation below are unaffected — neither needs one.*\n\n` +
            buildNarrative(plan)
        : buildNarrative(plan),
      "No model configured — built-in narrative",
    );
  }

  const system = question
    ? buildQuestionPrompt(plan.input.eventType)
    : buildPlanNarrativePrompt(plan.input.eventType);

  try {
    // `request.signal` is deliberately not forwarded. By the time a streaming
    // Response is being returned the incoming signal is already settled, and
    // passing it aborts the upstream call the instant it starts -- which
    // presents as a 200 with an empty body. Client disconnects are handled by
    // the returned stream's cancellation instead.
    const upstream = await streamCompletion(provider, {
      system,
      user: buildUserPrompt(planAsContext(plan), question),
      maxTokens: question ? 1_200 : 2_400,
    });

    return new Response(upstream.pipeThrough(verifyingTransform(plan, provider.label, false)), {
      headers: streamHeaders(provider.label),
    });
  } catch (error) {
    const safe =
      error instanceof ProviderError
        ? error.safeDetail
        : "The AI service could not be reached.";
    console.error("[ideas] provider failed; falling back to deterministic narrative", error);

    // The model failing is not a reason to show the user nothing. They get the
    // built-in narrative with the reason stated plainly above it.
    return deterministicResponse(
      plan,
      `*${safe} The explanation below is the built-in one, computed from your plan without a model.*\n\n` +
        buildNarrative(plan),
      `Fallback — ${provider.label} unavailable`,
    );
  }
}

/**
 * Append the verification envelope once the text is complete.
 *
 * `flush` runs after the model's last chunk, which is the earliest point the
 * whole text exists. Anything thrown in `transform` would otherwise become an
 * unhandled rejection that takes the route down, so it is contained: the stream
 * closes with whatever text arrived rather than failing the response.
 */
function verifyingTransform(
  plan: Plan,
  source: string,
  deterministic: boolean,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let text = "";

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      try {
        const piece = decoder.decode(chunk, { stream: true });
        if (!piece) return;
        text += piece;
        controller.enqueue(chunk);
      } catch (error) {
        console.error("[ideas] chunk decode failed", error);
      }
    },
    flush(controller) {
      try {
        const envelope: VerificationEnvelope = {
          verification: verifyAgainstPlan(text, plan),
          source,
          deterministic,
        };
        controller.enqueue(encoder.encode(VERIFICATION_MARKER + JSON.stringify(envelope)));
      } catch (error) {
        // Without an envelope the UI reports the text as unverified, which is
        // the correct thing for it to say.
        console.error("[ideas] verification failed", error);
      }
    },
  });
}

/**
 * Serve pre-built text through the same pipeline as a model response.
 *
 * Chunked rather than sent whole, so the client has exactly one code path and
 * the fallback is not a visibly different experience. It still goes through
 * verification: the narrative is generated from the plan, so it should verify
 * perfectly, and if a change to `lib/narrative.ts` ever introduces a figure that
 * is not in the plan, this is where it will show up.
 */
function deterministicResponse(plan: Plan, text: string, source: string): Response {
  const encoder = new TextEncoder();
  const CHUNK = 240;
  let offset = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= text.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(text.slice(offset, offset + CHUNK)));
      offset += CHUNK;
    },
  });

  return new Response(stream.pipeThrough(verifyingTransform(plan, source, true)), {
    headers: streamHeaders(source),
  });
}

function streamHeaders(source: string): Record<string, string> {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    // Prevents an intermediate proxy from buffering the stream into one lump.
    "X-Accel-Buffering": "no",
    // Lets the footer name the model without a second request. ASCII-only: a
    // header value with a non-Latin-1 character throws when the Response is
    // constructed, and a provider label is free text.
    "X-Shubh-Source": source.replace(/[^\x20-\x7E]/g, ""),
  };
}
