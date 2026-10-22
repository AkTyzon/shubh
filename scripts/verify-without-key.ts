/**
 * The zero-credential guarantee, asserted end to end.
 *
 * The README claims the product is fully functional with no API key. This script
 * is what makes that a fact rather than a sentence: it runs the real route
 * handler with the environment deliberately emptied and fails if the plan does
 * not balance, if no narrative is produced, or if the narrative does not verify
 * against its own plan.
 *
 * It lives in a file rather than inline in the workflow for two reasons: `tsx -e`
 * compiles to CommonJS and so cannot use top-level await, and a check worth
 * running in CI is worth being able to run locally.
 *
 *   npx tsx scripts/verify-without-key.ts
 */

import { POST as ideas } from "../app/api/ideas/route";
import { buildPlan } from "../lib/plan";
import { resolveProvider } from "../lib/llm";
import { splitStreamPayload } from "../lib/wire";
import type { PlanInput } from "../lib/types";

const CASES: PlanInput[] = [
  {
    eventType: "wedding",
    eventDate: offsetDays(270),
    guestCount: 300,
    cityTier: "metro",
    totalBudget: 2_500_000,
    priorities: ["catering"],
    today: today(),
  },
  // A plan the engine should refuse. The narrative still has to be produced and
  // still has to verify -- refusing is not an excuse for emitting loose numbers.
  {
    eventType: "wedding",
    eventDate: offsetDays(150),
    guestCount: 400,
    cityTier: "metro",
    totalBudget: 300_000,
    priorities: [],
    today: today(),
  },
  {
    eventType: "birthday",
    eventDate: offsetDays(45),
    guestCount: 40,
    cityTier: "tier3",
    totalBudget: 60_000,
    priorities: [],
    today: today(),
  },
  {
    eventType: "community",
    eventDate: offsetDays(60),
    guestCount: 400,
    cityTier: "tier2",
    totalBudget: 150_000,
    priorities: [],
    today: today(),
  },
  {
    eventType: "griha-pravesh",
    eventDate: offsetDays(30),
    guestCount: 60,
    cityTier: "tier1",
    totalBudget: 120_000,
    priorities: [],
    today: today(),
  },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function offsetDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  // If the environment this runs in has a key, the check is not testing what it
  // claims to test, so say so rather than passing for the wrong reason.
  const provider = resolveProvider(process.env);
  if (provider) {
    fail(
      `a model is configured (${provider.label}). This check must run with an empty ` +
        `environment, or it does not prove the zero-key path works.`,
    );
  }

  for (const input of CASES) {
    const label = `${input.eventType} ${input.guestCount}g ₹${input.totalBudget}`;

    const plan = buildPlan(input);
    const lineSum = plan.budget.lines.reduce((sum, line) => sum + line.allocated, 0);
    if (lineSum + plan.budget.contingency !== plan.budget.total) {
      fail(
        `${label}: budget does not balance — ${lineSum} + ${plan.budget.contingency} ` +
          `!= ${plan.budget.total}`,
      );
    }

    const response = await ideas(
      new Request("https://ci.test/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // A distinct address per case, so the rate limiter does not refuse one
        // case because of the previous one.
        body: JSON.stringify({ input }),
      }),
    );

    if (response.status !== 200) fail(`${label}: /api/ideas returned ${response.status}`);

    const { text, envelope } = splitStreamPayload(await response.text());

    if (!text.includes("## Where you stand")) fail(`${label}: no narrative was produced`);
    if (text.length < 800) fail(`${label}: narrative is only ${text.length} characters`);
    if (!envelope) fail(`${label}: no verification envelope was appended`);
    if (!envelope.deterministic) fail(`${label}: envelope claims a model produced this`);
    if (envelope.verification.matched === 0) fail(`${label}: nothing was actually checked`);
    if (envelope.verification.flagged !== 0) {
      fail(
        `${label}: the built-in narrative failed its own verification — ` +
          JSON.stringify(
            [...envelope.verification.figures, ...envelope.verification.dates].filter(
              (entry) => entry.status !== "matched",
            ),
          ),
      );
    }

    console.log(
      `  ok  ${label.padEnd(34)} ${String(text.length).padStart(5)} chars, ` +
        `${envelope.verification.matched} verified, 0 flagged, ${plan.issues.length} findings`,
    );
  }

  console.log(`\n${CASES.length} plans computed and narrated with no API key. Nothing flagged.`);
}

void main();
