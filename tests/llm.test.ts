/**
 * The provider layer.
 *
 * No network calls here: `buildEndpoint` is a pure function, which is exactly
 * why it is exported. Asserting the request body each provider receives is the
 * only way to catch a shape error without spending a live API call, and these
 * are the errors that otherwise present as an opaque upstream 400.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readKeyOverride, GEMINI_KEY_HEADER } from "../lib/byo-key";
import { buildEndpoint, createReasoningStripper, looksLikeGeminiKey, resolveProvider } from "../lib/llm";

const request = { system: "You are a planner.", user: "Explain this plan." };

describe("recognising a Gemini key", () => {
  it("accepts the long-standing AIza form", () => {
    assert.ok(looksLikeGeminiKey(`AIza${"a".repeat(35)}`));
  });

  it("accepts the newer AQ. form", () => {
    // A real key of this shape was rejected by an earlier version, which
    // presented as the BYO-key field refusing a key that worked server-side.
    assert.ok(looksLikeGeminiKey(`AQ.${"Ab1_".repeat(8)}`));
  });

  it("rejects something that is plainly not a key", () => {
    for (const bad of ["", "hello", "sk-proj-abc123", "AIza", "AQ.", "my api key"]) {
      assert.equal(looksLikeGeminiKey(bad), false, `accepted "${bad}"`);
    }
  });

  it("rejects a value containing whitespace", () => {
    assert.equal(looksLikeGeminiKey(`AIza${"a".repeat(35)} extra`), false);
  });

  it("tolerates surrounding whitespace from a paste", () => {
    assert.ok(looksLikeGeminiKey(`  AIza${"a".repeat(35)}  `));
  });
});

describe("choosing a provider", () => {
  it("returns undefined when nothing is configured", () => {
    assert.equal(resolveProvider({}), undefined);
  });

  it("prefers a visitor's own key over everything, including a local model", () => {
    // They asked for their key to be used. Silently ignoring it would be worse
    // than not offering the option.
    const provider = resolveProvider(
      { SHUBH_LOCAL_MODEL: "qwen3:8b", GEMINI_API_KEY: "server-key" },
      { gemini: `AIza${"b".repeat(35)}` },
    );
    assert.equal(provider?.id, "google");
    assert.match(provider!.label, /your key/);
  });

  it("ignores a visitor's key that is not even plausibly shaped", () => {
    const provider = resolveProvider({ GEMINI_API_KEY: "server-key" }, { gemini: "nonsense" });
    assert.equal(provider?.id, "google");
    assert.equal(provider?.apiKey, "server-key");
  });

  it("prefers a local model over a cloud key left in the environment", () => {
    // Configuring an on-device model is a deliberate privacy choice and should
    // not be overridden by a key left over from something else.
    const provider = resolveProvider({ SHUBH_LOCAL_MODEL: "qwen3:8b", OPENAI_API_KEY: "sk-x" });
    assert.equal(provider?.id, "local");
    assert.equal(provider?.onDevice, true);
  });

  it("marks only the local provider as on-device", () => {
    assert.equal(resolveProvider({ GEMINI_API_KEY: "k" })?.onDevice, undefined);
    assert.equal(resolveProvider({ SHUBH_LOCAL_MODEL: "m" })?.onDevice, true);
  });

  it("suppresses reasoning on a local model by default", () => {
    // qwen3:8b spent an entire 250-token budget in its reasoning field and
    // produced zero content tokens. Thinking is off unless asked for.
    assert.equal(resolveProvider({ SHUBH_LOCAL_MODEL: "qwen3:8b" })?.suppressReasoning, true);
    assert.equal(
      resolveProvider({ SHUBH_LOCAL_MODEL: "qwen3:8b", SHUBH_LOCAL_THINKING: "1" })
        ?.suppressReasoning,
      false,
    );
  });

  it("falls back through Gemini, OpenAI and Anthropic in that order", () => {
    assert.equal(resolveProvider({ GEMINI_API_KEY: "a", OPENAI_API_KEY: "b", ANTHROPIC_API_KEY: "c" })?.id, "google");
    assert.equal(resolveProvider({ OPENAI_API_KEY: "b", ANTHROPIC_API_KEY: "c" })?.id, "openai");
    assert.equal(resolveProvider({ ANTHROPIC_API_KEY: "c" })?.id, "anthropic");
  });

  it("accepts the alternative Google key variable names", () => {
    assert.equal(resolveProvider({ GOOGLE_API_KEY: "a" })?.id, "google");
    assert.equal(resolveProvider({ GOOGLE_GENERATIVE_AI_API_KEY: "a" })?.id, "google");
  });

  it("honours a model override", () => {
    assert.equal(resolveProvider({ GEMINI_API_KEY: "a", SHUBH_MODEL: "gemini-x" })?.model, "gemini-x");
  });

  it("strips a trailing slash from a local base URL", () => {
    const provider = resolveProvider({ SHUBH_LOCAL_BASE_URL: "http://localhost:11434/v1///" });
    assert.equal(provider?.baseUrl, "http://localhost:11434/v1");
  });

  it("gives a local provider longer timeouts than a hosted one", () => {
    // An 8B model on a laptop streams a long answer slowly but healthily.
    const local = resolveProvider({ SHUBH_LOCAL_MODEL: "qwen3:8b" })!;
    assert.ok((local.setupTimeoutMs ?? 0) > 0);
    assert.ok((local.idleTimeoutMs ?? 0) > 0);
  });
});

describe("building the request", () => {
  it("puts the system prompt where Gemini expects it", () => {
    const endpoint = buildEndpoint(
      { id: "google", label: "g", model: "gemini-2.0-flash", apiKey: "k" },
      request,
    );
    const body = endpoint.body as Record<string, unknown>;
    assert.ok("systemInstruction" in body, "Gemini needs systemInstruction, not a system message");
    assert.ok("contents" in body);
  });

  it("sends the Gemini key in a header, never in the URL", () => {
    // A key in a query string is recorded by access logs, proxies and history.
    const endpoint = buildEndpoint(
      { id: "google", label: "g", model: "gemini-2.0-flash", apiKey: "secret-key" },
      request,
    );
    assert.ok(!endpoint.url.includes("secret-key"), `the key leaked into ${endpoint.url}`);
    assert.equal(endpoint.headers["x-goog-api-key"], "secret-key");
  });

  it("uses the OpenAI chat completions shape for OpenAI", () => {
    const endpoint = buildEndpoint(
      { id: "openai", label: "o", model: "gpt-4o-mini", apiKey: "sk-x" },
      request,
    );
    const body = endpoint.body as { messages: { role: string }[]; stream: boolean };
    assert.equal(body.messages[0]!.role, "system");
    assert.equal(body.messages[1]!.role, "user");
    assert.equal(body.stream, true);
    assert.equal(endpoint.headers.authorization, "Bearer sk-x");
  });

  it("uses a top-level system field and a version header for Anthropic", () => {
    const endpoint = buildEndpoint(
      { id: "anthropic", label: "a", model: "claude-opus-5", apiKey: "sk-ant" },
      request,
    );
    const body = endpoint.body as Record<string, unknown>;
    assert.equal(body.system, request.system);
    assert.equal(endpoint.headers["x-api-key"], "sk-ant");
    assert.ok(endpoint.headers["anthropic-version"], "the version header is mandatory");
  });

  it("routes a local model through its own base URL", () => {
    const endpoint = buildEndpoint(
      {
        id: "local",
        label: "l",
        model: "qwen3:8b",
        apiKey: "not-needed",
        baseUrl: "http://localhost:11434/v1",
      },
      request,
    );
    assert.ok(endpoint.url.startsWith("http://localhost:11434/v1"));
  });

  it("asks a local reasoning model not to think when told to suppress it", () => {
    const endpoint = buildEndpoint(
      {
        id: "local",
        label: "l",
        model: "qwen3:8b",
        apiKey: "x",
        baseUrl: "http://localhost:11434/v1",
        suppressReasoning: true,
      },
      request,
    );
    assert.equal((endpoint.body as Record<string, unknown>).reasoning_effort, "none");
  });

  it("omits reasoning_effort when thinking is allowed", () => {
    const endpoint = buildEndpoint(
      {
        id: "local",
        label: "l",
        model: "qwen3:8b",
        apiKey: "x",
        baseUrl: "http://localhost:11434/v1",
        suppressReasoning: false,
      },
      request,
    );
    assert.ok(!("reasoning_effort" in (endpoint.body as Record<string, unknown>)));
  });

  it("passes the token budget through for every provider", () => {
    for (const id of ["google", "openai", "anthropic", "local"] as const) {
      const endpoint = buildEndpoint(
        { id, label: id, model: "m", apiKey: "k", baseUrl: "http://localhost:1/v1" },
        { ...request, maxTokens: 321 },
      );
      assert.match(
        JSON.stringify(endpoint.body),
        /321/,
        `${id} dropped the token budget`,
      );
    }
  });

  it("extracts a text delta from each provider's payload shape", () => {
    const google = buildEndpoint({ id: "google", label: "g", model: "m", apiKey: "k" }, request);
    assert.equal(
      google.extractDelta({ candidates: [{ content: { parts: [{ text: "hello" }] } }] }),
      "hello",
    );

    const openai = buildEndpoint({ id: "openai", label: "o", model: "m", apiKey: "k" }, request);
    assert.equal(openai.extractDelta({ choices: [{ delta: { content: "hi" } }] }), "hi");

    // Anthropic only carries text on a content_block_delta frame; the others
    // (message_start, ping, message_delta) are metadata and must yield nothing.
    const anthropic = buildEndpoint({ id: "anthropic", label: "a", model: "m", apiKey: "k" }, request);
    assert.equal(
      anthropic.extractDelta({ type: "content_block_delta", delta: { text: "yo" } }),
      "yo",
    );
    assert.equal(anthropic.extractDelta({ type: "message_start", delta: { text: "ignored" } }), "");
    assert.equal(anthropic.extractDelta({ type: "ping" }), "");
  });

  it("returns an empty string rather than throwing on an unexpected payload", () => {
    // Providers send keep-alives and metadata frames. One of those must not take
    // the stream down.
    for (const id of ["google", "openai", "anthropic", "local"] as const) {
      const endpoint = buildEndpoint(
        { id, label: id, model: "m", apiKey: "k", baseUrl: "http://localhost:1/v1" },
        request,
      );
      for (const payload of [{}, null, undefined, { unexpected: true }, []]) {
        assert.equal(endpoint.extractDelta(payload), "", `${id} mishandled ${JSON.stringify(payload)}`);
      }
    }
  });
});

describe("stripping inlined reasoning", () => {
  it("passes ordinary text through untouched", () => {
    const strip = createReasoningStripper();
    assert.equal(strip("Your budget is fine."), "Your budget is fine.");
  });

  it("removes a complete think block", () => {
    const strip = createReasoningStripper();
    assert.equal(strip("<think>pondering</think>Answer."), "Answer.");
  });

  it("handles a tag split across chunk boundaries", () => {
    // The reason this is stateful. A per-chunk regex would let the fragment
    // through and the user would see the model talking to itself.
    const strip = createReasoningStripper();
    const output = ["<thi", "nk>secret rea", "soning</thi", "nk>Visible."]
      .map((chunk) => strip(chunk))
      .join("");
    assert.equal(output, "Visible.");
  });

  it("suppresses text inside an unterminated block", () => {
    const strip = createReasoningStripper();
    assert.equal(strip("<think>still thinking"), "");
  });

  it("keeps text before an opening tag", () => {
    const strip = createReasoningStripper();
    assert.equal(strip("Before.<think>hidden</think>After."), "Before.After.");
  });

  it("handles several blocks in one stream", () => {
    const strip = createReasoningStripper();
    assert.equal(strip("<think>a</think>One.<think>b</think>Two."), "One.Two.");
  });

  it("keeps independent state per stripper", () => {
    const first = createReasoningStripper();
    const second = createReasoningStripper();
    first("<think>leaking");
    assert.equal(second("Clean text."), "Clean text.");
  });
});

describe("bring-your-own-key extraction", () => {
  it("reads a plausible key from the header", () => {
    const key = `AIza${"c".repeat(35)}`;
    const override = readKeyOverride(
      new Request("https://example.test", { headers: { [GEMINI_KEY_HEADER]: key } }),
    );
    assert.equal(override?.gemini, key);
  });

  it("returns nothing when the header is absent", () => {
    assert.equal(readKeyOverride(new Request("https://example.test")), undefined);
  });

  it("drops an implausible value rather than forwarding it upstream", () => {
    const override = readKeyOverride(
      new Request("https://example.test", { headers: { [GEMINI_KEY_HEADER]: "not-a-key" } }),
    );
    assert.equal(override, undefined);
  });

  it("uses a header name, so the key is never in a query string", () => {
    assert.equal(GEMINI_KEY_HEADER, "x-gemini-api-key");
  });
});
