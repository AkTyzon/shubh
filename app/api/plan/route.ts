/**
 * POST /api/plan — the computed plan.
 *
 * No language model is involved. Same input, same plan, every time, with or
 * without an API key configured. This route is the product; `/api/ideas` is
 * commentary on top of it.
 *
 * It runs on the Node runtime rather than the edge because the knowledge modules
 * run assertions at import time (shares summing to exactly 100%, task graphs
 * being acyclic) and a failure there should be a loud server error, not a
 * partially-initialised edge isolate.
 */

import { buildPlan, parsePlanInput, PlanInputError } from "@/lib/plan";
import { resolveProvider } from "@/lib/llm";
import { readKeyOverride } from "@/lib/byo-key";
import { clientKey, RateLimiter } from "@/lib/rate-limit";
import type { PlanResponse } from "@/lib/wire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generous, because this endpoint costs nothing but CPU.
 *
 * It is here to stop a loop hammering the deployment, not to meter a resource.
 * The model endpoint is the one with a real cost and it is limited far harder.
 */
const limiter = new RateLimiter(60, 60_000);

export async function POST(request: Request): Promise<Response> {
  const limit = limiter.check(clientKey(request));
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many requests. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  limiter.sweep();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body.", field: "form" }, { status: 400 });
  }

  try {
    const input = parsePlanInput(body);
    const plan = buildPlan(input);
    const provider = resolveProvider(process.env, readKeyOverride(request));

    const payload: PlanResponse = {
      plan,
      provider: provider?.label ?? null,
      onDevice: provider?.onDevice ?? false,
    };

    return Response.json(payload, {
      // The plan is a pure function of the body, so it is safely cacheable by the
      // client for a short window. Not shared-cacheable: a BYO key in the request
      // changes the `provider` field, and that must not leak between visitors.
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    if (error instanceof PlanInputError) {
      return Response.json({ error: error.message, field: error.field }, { status: 400 });
    }
    // An unexpected throw here means an engine invariant broke -- the budget did
    // not balance, or a task graph is inconsistent. Log it in full, tell the user
    // nothing about the internals.
    console.error("[plan] unexpected failure", error);
    return Response.json(
      { error: "Could not compute a plan for that input.", field: "form" },
      { status: 500 },
    );
  }
}
