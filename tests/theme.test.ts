/**
 * Occasion theming.
 *
 * Theming is decoration, and these tests exist to keep it that way: the palette
 * must be complete for every occasion, the budget bar ramp must produce
 * distinguishable neighbours, and nothing here may become the only carrier of
 * meaning.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OCCASION_LIST, OCCASIONS, occasionFor, rampColour } from "../lib/theme";
import { EVENT_TYPES } from "./helpers";

describe("occasions", () => {
  it("defines one per event type, and no more", () => {
    assert.equal(OCCASION_LIST.length, EVENT_TYPES.length);
    for (const eventType of EVENT_TYPES) {
      assert.equal(occasionFor(eventType).id, eventType);
    }
  });

  it("gives every occasion a label, a noun, a blurb and a glyph", () => {
    for (const occasion of OCCASION_LIST) {
      assert.ok(occasion.label.length > 2, `${occasion.id} has no label`);
      assert.ok(occasion.noun.length > 2, `${occasion.id} has no noun`);
      assert.ok(occasion.blurb.length > 25, `${occasion.id} has no useful blurb`);
      assert.ok(occasion.glyph.length > 0, `${occasion.id} has no glyph`);
    }
  });

  it("gives every occasion two distinct hues", () => {
    for (const occasion of OCCASION_LIST) {
      const [a, b] = occasion.hues;
      assert.ok(a >= 0 && a < 360, `${occasion.id} hue A out of range`);
      assert.ok(b >= 0 && b < 360, `${occasion.id} hue B out of range`);
      // The ramp alternates between the two, so identical hues would defeat it.
      assert.ok(
        Math.abs(a - b) > 20,
        `${occasion.id}'s two hues are too close to alternate between`,
      );
    }
  });

  it("gives each occasion a visually distinct identity", () => {
    const primaries = OCCASION_LIST.map((occasion) => occasion.hues[0]);
    assert.equal(new Set(primaries).size, primaries.length, "two occasions share a primary hue");
  });

  it("uses a different glyph per occasion", () => {
    const glyphs = OCCASION_LIST.map((occasion) => occasion.glyph);
    assert.equal(new Set(glyphs).size, glyphs.length);
  });
});

describe("the budget bar ramp", () => {
  it("returns a valid CSS colour for every index", () => {
    for (const occasion of OCCASION_LIST) {
      for (let total = 1; total <= 12; total += 1) {
        for (let index = 0; index < total; index += 1) {
          const colour = rampColour(occasion, index, total);
          assert.match(
            colour,
            /^hsl\(\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%\)$/,
            `${occasion.id} ${index}/${total} produced "${colour}"`,
          );
        }
      }
    }
  });

  it("keeps lightness inside a band where no segment vanishes", () => {
    // A segment at 0% or 100% lightness disappears into the surface at one end
    // of the theme or the other.
    for (const occasion of OCCASION_LIST) {
      for (let index = 0; index < 12; index += 1) {
        const lightness = Number(
          /(\d+(?:\.\d+)?)%\)$/.exec(rampColour(occasion, index, 12))![1],
        );
        assert.ok(lightness >= 30 && lightness <= 78, `lightness ${lightness}% is out of band`);
      }
    }
  });

  it("makes adjacent segments distinguishable", () => {
    // A single-hue ramp across ten categories produces neighbours nobody can
    // tell apart, which is why the ramp alternates hue as well as lightness.
    for (const occasion of OCCASION_LIST) {
      for (let index = 1; index < 11; index += 1) {
        const previous = rampColour(occasion, index - 1, 11);
        const current = rampColour(occasion, index, 11);
        assert.notEqual(previous, current, `${occasion.id} repeats a colour at ${index}`);

        const hueOf = (colour: string) => Number(/^hsl\((\d+(?:\.\d+)?)/.exec(colour)![1]);
        const lightOf = (colour: string) => Number(/(\d+(?:\.\d+)?)%\)$/.exec(colour)![1]);

        // Either the hue shifts materially or the lightness does.
        const hueGap = Math.abs(hueOf(previous) - hueOf(current));
        const lightGap = Math.abs(lightOf(previous) - lightOf(current));
        assert.ok(
          hueGap > 20 || lightGap > 3,
          `${occasion.id} segments ${index - 1} and ${index} are too similar`,
        );
      }
    }
  });

  it("does not divide by zero when there is a single category", () => {
    for (const occasion of OCCASION_LIST) {
      assert.doesNotThrow(() => rampColour(occasion, 0, 1));
      assert.match(rampColour(occasion, 0, 1), /^hsl\(/);
    }
  });

  it("is deterministic", () => {
    assert.equal(
      rampColour(OCCASIONS.wedding, 3, 10),
      rampColour(OCCASIONS.wedding, 3, 10),
    );
  });
});
