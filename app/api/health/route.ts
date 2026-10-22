/**
 * GET /api/health — what this deployment can actually do.
 *
 * Exists so the state of an instance can be checked without guessing from the
 * UI: whether a model is configured, which one, and whether the deterministic
 * engines are sound. It names the provider but never the key, and reports no
 * version or dependency detail that would help someone probe the host.
 *
 * The engine check is not decoration. The knowledge modules assert their own
 * invariants at import time -- budget shares summing to exactly 100%, task
 * graphs being acyclic -- so a successful import is a real signal, and this
 * route additionally computes a plan end to end and confirms it balances.
 */

import { resolveProvider } from "@/lib/llm";
import { buildPlan } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const provider = resolveProvider(process.env);

  let engines: "ok" | "failing" = "ok";
  let detail: string | undefined;
  try {
    const plan = buildPlan({
      eventType: "wedding",
      eventDate: "2027-02-14",
      guestCount: 250,
      cityTier: "tier1",
      totalBudget: 1_500_000,
      priorities: [],
      today: "2026-10-22",
    });
    if (plan.budget.allocated !== plan.budget.total) {
      engines = "failing";
      detail = "Budget allocation does not balance.";
    }
  } catch (error) {
    engines = "failing";
    detail = "Engine self-check threw.";
    console.error("[health] engine self-check failed", error);
  }

  return Response.json(
    {
      status: engines === "ok" ? "ok" : "degraded",
      engines,
      detail,
      // The plan works without a model, so no provider is not an error.
      model: provider ? { configured: true, label: provider.label, onDevice: provider.onDevice ?? false } : { configured: false },
    },
    { status: engines === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
