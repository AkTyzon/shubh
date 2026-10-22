/**
 * The stream format.
 *
 * A mismatch here between the route and the browser is invisible until a user
 * sees a raw sentinel string in the middle of their plan, so the splitter is
 * tested against the partial states a real stream actually passes through.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitStreamPayload, VERIFICATION_MARKER } from "../lib/wire";

const envelope = { verification: { figures: [], dates: [], matched: 0, flagged: 0, unquantified: true }, source: "test", deterministic: true };

describe("splitting the stream", () => {
  it("returns the text alone while the envelope has not arrived", () => {
    const result = splitStreamPayload("## Where you stand\n\nYour budget is fine.");
    assert.equal(result.text, "## Where you stand\n\nYour budget is fine.");
    assert.equal(result.envelope, undefined);
  });

  it("separates the text from the envelope once complete", () => {
    const body = `Narrative text.${VERIFICATION_MARKER}${JSON.stringify(envelope)}`;
    const result = splitStreamPayload(body);
    assert.equal(result.text, "Narrative text.");
    assert.equal(result.envelope?.source, "test");
    assert.equal(result.envelope?.deterministic, true);
  });

  it("keeps the narrative when the envelope is truncated mid-JSON", () => {
    // A dropped connection leaves a half-written envelope. The narrative is
    // still worth showing; the UI then reports it as unverified.
    const body = `Narrative text.${VERIFICATION_MARKER}{"verification":{"fig`;
    const result = splitStreamPayload(body);
    assert.equal(result.text, "Narrative text.");
    assert.equal(result.envelope, undefined);
  });

  it("keeps the narrative when the marker arrived but nothing followed", () => {
    const result = splitStreamPayload(`Narrative text.${VERIFICATION_MARKER}`);
    assert.equal(result.text, "Narrative text.");
    assert.equal(result.envelope, undefined);
  });

  it("handles an empty body", () => {
    assert.deepEqual(splitStreamPayload(""), { text: "" });
  });

  it("does not split on text that merely resembles the marker", () => {
    const body = "The verification said shubh-verification was fine.";
    assert.equal(splitStreamPayload(body).text, body);
  });

  it("uses a sentinel a model will not produce on its own", () => {
    // U+241E, the symbol for a record separator. It is not on any keyboard and
    // does not appear in natural prose.
    assert.ok(VERIFICATION_MARKER.includes("␞"));
    assert.ok(VERIFICATION_MARKER.startsWith("\n"));
  });

  it("splits correctly at every prefix length of a complete body", () => {
    // Exactly what the browser does: it calls the splitter on a growing buffer.
    const text = "A plan narrative with ₹1,00,000 in it.";
    const body = `${text}${VERIFICATION_MARKER}${JSON.stringify(envelope)}`;

    for (let length = 0; length <= body.length; length += 1) {
      const partial = body.slice(0, length);
      const result = splitStreamPayload(partial);
      assert.ok(
        text.startsWith(result.text) || result.text === text,
        `at length ${length} the text was corrupted: "${result.text}"`,
      );
      // The envelope only ever appears once it is complete and parseable.
      if (result.envelope) assert.equal(length, body.length);
    }
  });
});

describe("a partially arrived marker", () => {
  it("holds back a trailing fragment rather than rendering it", () => {
    // The sentinel starts with a newline, so without this the UI would briefly
    // flash "\n␞::shubh-ver" at the end of the narrative.
    const text = "Narrative text.";
    for (let length = 1; length < VERIFICATION_MARKER.length; length += 1) {
      const partial = text + VERIFICATION_MARKER.slice(0, length);
      assert.equal(
        splitStreamPayload(partial).text,
        text,
        `a ${length}-character marker fragment leaked into the text`,
      );
    }
  });

  it("renders everything up to a trailing newline, deferring only that newline", () => {
    // A newline is the marker's first character, so a buffer ending in one is
    // genuinely ambiguous and the newline waits for the next chunk. The cost is
    // one deferred blank line; the prose before it renders immediately.
    assert.equal(splitStreamPayload("First paragraph.\n").text, "First paragraph.");
    assert.equal(splitStreamPayload("First paragraph.\n\n").text, "First paragraph.\n");
    // Nothing is held back when the buffer does not end in a marker prefix.
    assert.equal(
      splitStreamPayload("First paragraph.\n\nSecond.").text,
      "First paragraph.\n\nSecond.",
    );
  });
});
