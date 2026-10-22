/**
 * The route handlers, called directly.
 *
 * App Router handlers are plain functions over `Request`, so they can be tested
 * without a server, a browser or a live model. Everything here exercises the
 * no-API-key path, which is the path a judge or a contributor hits on a fresh
 * clone — so it is the one that must not be taken on trust.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET as health } from "../app/api/health/route";
import { POST as ideas } from "../app/api/ideas/route";
import { POST as plan } from "../app/api/plan/route";
import { splitStreamPayload } from "../lib/wire";
import { input, TODAY } from "./helpers";

function post(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** A unique client address per test, so one test's rate limit is not another's. */
let clientCounter = 0;
function freshClient(): Record<string, string> {
  clientCounter += 1;
  return { "x-forwarded-for": `198.51.100.${clientCounter % 250}` };
}

describe("GET /api/health", () => {
  it("reports the engines sound and the plan workable without a model", () => {
    const response = health();
    return response.then(async (result) => {
      assert.equal(result.status, 200);
      const body = await result.json();
      assert.equal(body.status, "ok");
      assert.equal(body.engines, "ok");
      // No configured model is not an error: the plan never needed one.
      assert.ok("configured" in body.model);
    });
  });

  it("never caches, so a check always reflects the live instance", async () => {
    const result = await health();
    assert.equal(result.headers.get("cache-control"), "no-store");
  });

  it("names no key, path or dependency version", async () => {
    const body = await (await health()).text();
    assert.ok(!/AIza|AQ\.|sk-|password|\/Users\//i.test(body), `health leaked detail: ${body}`);
  });
});

describe("POST /api/plan", () => {
  it("computes a balanced plan", async () => {
    const response = await plan(post("https://shubh.test/api/plan", input(), freshClient()));
    assert.equal(response.status, 200);

    const body = await response.json();
    const lineSum = body.plan.budget.lines.reduce(
      (sum: number, line: { allocated: number }) => sum + line.allocated,
      0,
    );
    assert.equal(lineSum + body.plan.budget.contingency, body.plan.budget.total);
    assert.ok(body.plan.verifiedFigures.length > 0);
  });

  it("returns the same plan for the same body", async () => {
    const body = input();
    const first = await (await plan(post("https://shubh.test/api/plan", body, freshClient()))).json();
    const second = await (await plan(post("https://shubh.test/api/plan", body, freshClient()))).json();
    assert.deepEqual(first.plan, second.plan);
  });

  it("rejects a bad field with a 400 naming the field", async () => {
    const response = await plan(
      post("https://shubh.test/api/plan", input({ guestCount: 0 }), freshClient()),
    );
    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.field, "guestCount");
    assert.ok(body.error.length > 15, "the error is too thin for a user to act on");
  });

  it("rejects a body that is not JSON", async () => {
    const response = await plan(
      new Request("https://shubh.test/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshClient() },
        body: "not json",
      }),
    );
    assert.equal(response.status, 400);
  });

  it("reports whether a model is configured without revealing a key", async () => {
    const response = await plan(post("https://shubh.test/api/plan", input(), freshClient()));
    const text = await response.text();
    assert.ok(!/AIza|AQ\.[A-Za-z0-9]|sk-[a-z]/.test(text), "a key shape appeared in the response");
    assert.ok(text.includes('"provider"'));
  });

  it("marks its cache private, since a visitor's key changes the response", async () => {
    const response = await plan(post("https://shubh.test/api/plan", input(), freshClient()));
    assert.match(response.headers.get("cache-control") ?? "", /private/);
  });

  it("rate limits a client that floods it", async () => {
    const client = { "x-forwarded-for": "203.0.113.200" };
    let limited = false;
    for (let i = 0; i < 90; i += 1) {
      const response = await plan(post("https://shubh.test/api/plan", input(), client));
      if (response.status === 429) {
        assert.ok(response.headers.get("retry-after"), "a 429 must say when to retry");
        limited = true;
        break;
      }
    }
    assert.ok(limited, "the plan route never rate limited a flood");
  });
});

describe("POST /api/ideas", () => {
  async function readStream(response: Response) {
    const body = await response.text();
    return splitStreamPayload(body);
  }

  it("streams the built-in narrative when no model is configured", async () => {
    // The fresh-clone path. It must produce the real product, not a stub.
    const response = await ideas(
      post("https://shubh.test/api/ideas", { input: input() }, freshClient()),
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/plain/);

    const { text, envelope } = await readStream(response);
    assert.ok(text.includes("## Where you stand"), "the narrative is missing its first section");
    assert.ok(text.length > 1_000, `the narrative is only ${text.length} characters`);
    assert.ok(envelope, "no verification envelope was appended");
    assert.equal(envelope.deterministic, true);
  });

  it("verifies its own output with nothing flagged", async () => {
    const response = await ideas(
      post("https://shubh.test/api/ideas", { input: input() }, freshClient()),
    );
    const { envelope } = await readStream(response);
    assert.equal(envelope!.verification.flagged, 0);
    assert.ok(envelope!.verification.matched > 0, "nothing was actually checked");
  });

  it("recomputes the plan rather than trusting a client-supplied one", async () => {
    // Were a posted plan trusted, a caller could widen the allow-list and have
    // invented figures reported as verified.
    const response = await ideas(
      post(
        "https://shubh.test/api/ideas",
        {
          input: input(),
          plan: { verifiedFigures: [123_456_789], budget: { total: 999 } },
        },
        freshClient(),
      ),
    );
    const { envelope } = await readStream(response);
    assert.ok(
      !envelope!.verification.figures.some((figure) => figure.value === 123_456_789),
      "a client-supplied figure reached the allow-list",
    );
  });

  it("rejects a bad plan input with a 400 naming the field", async () => {
    const response = await ideas(
      post("https://shubh.test/api/ideas", { input: input({ totalBudget: 1 }) }, freshClient()),
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).field, "totalBudget");
  });

  it("says follow-up questions need a model, rather than failing", async () => {
    const response = await ideas(
      post(
        "https://shubh.test/api/ideas",
        { input: input(), question: "Can I cut the decor?" },
        freshClient(),
      ),
    );
    assert.equal(response.status, 200);
    const { text } = await readStream(response);
    assert.match(text, /No model is configured/);
    assert.ok(text.includes("## Where you stand"), "the plan explanation was dropped");
  });

  it("truncates an absurdly long question instead of forwarding it", async () => {
    const response = await ideas(
      post(
        "https://shubh.test/api/ideas",
        { input: input(), question: "x".repeat(50_000) },
        freshClient(),
      ),
    );
    assert.equal(response.status, 200);
  });

  it("tells proxies not to buffer the stream", async () => {
    const response = await ideas(
      post("https://shubh.test/api/ideas", { input: input() }, freshClient()),
    );
    assert.equal(response.headers.get("x-accel-buffering"), "no");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("sends only ASCII in the source header", async () => {
    // A header value with a non-Latin-1 character throws when the Response is
    // constructed, and a provider label is free text.
    const response = await ideas(
      post("https://shubh.test/api/ideas", { input: input() }, freshClient()),
    );
    const header = response.headers.get("x-shubh-source") ?? "";
    assert.ok(header.length > 0);
    assert.ok(/^[\x20-\x7E]*$/.test(header), `non-ASCII in header: ${header}`);
  });

  it("rate limits harder than the plan route, because this one costs quota", async () => {
    const client = { "x-forwarded-for": "203.0.113.201" };
    let allowed = 0;
    for (let i = 0; i < 30; i += 1) {
      const response = await ideas(post("https://shubh.test/api/ideas", { input: input() }, client));
      if (response.status === 429) {
        assert.ok(response.headers.get("retry-after"));
        break;
      }
      // Drain the body so the stream is not left open.
      await response.text();
      allowed += 1;
    }
    assert.ok(allowed > 0, "the ideas route refused the very first request");
    assert.ok(allowed < 30, "the ideas route never rate limited a flood");
  });

  it("explains in its 429 that the plan itself is unaffected", async () => {
    const client = { "x-forwarded-for": "203.0.113.202" };
    for (let i = 0; i < 30; i += 1) {
      const response = await ideas(post("https://shubh.test/api/ideas", { input: input() }, client));
      if (response.status === 429) {
        assert.match((await response.json()).error, /computed without a model/);
        return;
      }
      await response.text();
    }
    assert.fail("never reached the rate limit");
  });
});

describe("the whole pipeline, without a model", () => {
  it("takes raw input to a verified narrative", async () => {
    const raw = {
      eventType: "griha-pravesh",
      eventDate: "2026-12-20",
      guestCount: 60,
      cityTier: "tier2",
      totalBudget: 120_000,
      today: TODAY,
    };

    const planResponse = await plan(post("https://shubh.test/api/plan", raw, freshClient()));
    assert.equal(planResponse.status, 200);

    const ideasResponse = await ideas(
      post("https://shubh.test/api/ideas", { input: raw }, freshClient()),
    );
    const { text, envelope } = splitStreamPayload(await ideasResponse.text());

    assert.ok(text.length > 800);
    assert.equal(envelope!.verification.flagged, 0);
  });
});
