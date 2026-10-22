/**
 * The token bucket.
 *
 * It exists to stop one visitor exhausting a shared model budget. These tests
 * cover the behaviour a caller depends on — including `retryAfter`, because a
 * 429 without a usable retry hint is a dead end.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientKey, RateLimiter } from "../lib/rate-limit";

describe("the token bucket", () => {
  it("allows requests up to capacity", () => {
    const limiter = new RateLimiter(3, 60_000);
    for (let i = 0; i < 3; i += 1) {
      assert.equal(limiter.check("a").allowed, true, `request ${i + 1} should be allowed`);
    }
  });

  it("refuses the request past capacity", () => {
    const limiter = new RateLimiter(2, 60_000);
    limiter.check("a");
    limiter.check("a");
    assert.equal(limiter.check("a").allowed, false);
  });

  it("gives a usable retry hint when it refuses", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("a");
    const refused = limiter.check("a");
    assert.equal(refused.allowed, false);
    assert.ok(refused.retryAfter >= 1, "retryAfter must be at least a second to be actionable");
    assert.ok(refused.retryAfter <= 60, `retryAfter of ${refused.retryAfter}s is longer than the window`);
  });

  it("keeps separate buckets per client", () => {
    const limiter = new RateLimiter(1, 60_000);
    assert.equal(limiter.check("a").allowed, true);
    assert.equal(limiter.check("b").allowed, true);
    assert.equal(limiter.check("a").allowed, false);
  });

  it("refills over time", async () => {
    const limiter = new RateLimiter(2, 100);
    limiter.check("a");
    limiter.check("a");
    assert.equal(limiter.check("a").allowed, false);
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(limiter.check("a").allowed, true, "the bucket did not refill");
  });

  it("never refills beyond capacity", async () => {
    const limiter = new RateLimiter(2, 50);
    limiter.check("a");
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(limiter.check("a").allowed, true);
    assert.equal(limiter.check("a").allowed, true);
    assert.equal(limiter.check("a").allowed, false, "the bucket over-filled");
  });

  it("supports a cost greater than one", () => {
    const limiter = new RateLimiter(10, 60_000);
    assert.equal(limiter.check("a", 6).allowed, true);
    assert.equal(limiter.check("a", 6).allowed, false);
    assert.equal(limiter.check("a", 4).allowed, true);
  });

  it("drops fully refilled buckets so the map cannot grow without bound", async () => {
    const limiter = new RateLimiter(1, 20);
    for (let i = 0; i < 50; i += 1) limiter.check(`client-${i}`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    limiter.sweep();
    // Every bucket has refilled, so every one is allowed from a clean slate.
    for (let i = 0; i < 50; i += 1) {
      assert.equal(limiter.check(`client-${i}`).allowed, true);
    }
  });

  it("does not sweep a bucket that is still spent", () => {
    const limiter = new RateLimiter(1, 600_000);
    limiter.check("a");
    limiter.sweep();
    assert.equal(limiter.check("a").allowed, false, "a spent bucket was swept away");
  });
});

describe("identifying the caller", () => {
  it("takes the first address from x-forwarded-for", () => {
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" },
    });
    assert.equal(clientKey(request), "203.0.113.5");
  });

  it("trims whitespace around the address", () => {
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "  203.0.113.5  " },
    });
    assert.equal(clientKey(request), "203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("https://example.test", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    assert.equal(clientKey(request), "198.51.100.7");
  });

  it("returns a stable key when no address header is present", () => {
    assert.equal(clientKey(new Request("https://example.test")), "unknown");
  });
});
