/**
 * The generated artwork.
 *
 * The art is decoration, so these tests are not about how it looks — they are
 * about the properties that would silently break the page: a missing file is a
 * broken image, a stray `width`/`height` stops it scaling, and a megabyte of
 * path data on a mobile connection is worse than no ornament at all.
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ART = join(process.cwd(), "public", "art");
const PIECES = ["rangoli.svg", "toran.svg", "jaali.svg", "arch.svg"];

function read(name: string): string {
  return readFileSync(join(ART, name), "utf8");
}

describe("the art files exist and are usable", () => {
  it("has every piece the stylesheet and components reference", () => {
    for (const piece of PIECES) {
      assert.ok(existsSync(join(ART, piece)), `public/art/${piece} is missing`);
    }
  });

  it("is SVG, with a viewBox so it scales", () => {
    for (const piece of PIECES) {
      const svg = read(piece);
      assert.match(svg, /^<svg\s/, `${piece} does not start with <svg>`);
      assert.match(svg, /viewBox="[\d.\s-]+"/, `${piece} has no viewBox and will not scale`);
      assert.match(svg, /<\/svg>$/, `${piece} is truncated`);
    }
  });

  it("stays small enough to be ornament rather than payload", () => {
    for (const piece of PIECES) {
      const bytes = statSync(join(ART, piece)).size;
      assert.ok(bytes < 12_000, `${piece} is ${bytes} bytes, too heavy for decoration`);
      assert.ok(bytes > 200, `${piece} is suspiciously small at ${bytes} bytes`);
    }
  });

  it("marks itself decorative, so assistive technology skips it", () => {
    for (const piece of PIECES) {
      assert.match(read(piece), /role="presentation"/, `${piece} is not marked decorative`);
    }
  });

  it("embeds no script, no external reference and no raster payload", () => {
    // An SVG is a document. One that could execute or phone out has no business
    // being served from this origin under a `default-src 'self'` policy.
    for (const piece of PIECES) {
      const svg = read(piece);
      assert.ok(!/<script/i.test(svg), `${piece} contains a script`);
      assert.ok(!/xlink:href|href\s*=|url\(http/i.test(svg), `${piece} references something external`);
      assert.ok(!/data:image/i.test(svg), `${piece} embeds a raster image`);
    }
  });

  it("draws the tiling pieces to a whole-number grid so they repeat seamlessly", () => {
    // The jaali and the toran are used as repeating backgrounds. A fractional
    // viewBox produces a visible seam at every tile boundary.
    for (const piece of ["jaali.svg", "toran.svg"]) {
      const viewBox = /viewBox="([^"]+)"/.exec(read(piece))![1]!;
      const [, , width, height] = viewBox.split(/\s+/).map(Number);
      assert.ok(Number.isInteger(width), `${piece} has a fractional width`);
      assert.ok(Number.isInteger(height), `${piece} has a fractional height`);
    }
  });

  it("is reachable from the stylesheet at the path the files actually live at", () => {
    // A renamed file and a stale url() produce a silently missing background,
    // which is the kind of thing nobody notices until a judge does.
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    for (const match of css.matchAll(/url\("?(\/art\/[^")]+)"?\)/g)) {
      const referenced = match[1]!.replace("/art/", "");
      assert.ok(
        existsSync(join(ART, referenced)),
        `globals.css references /art/${referenced}, which does not exist`,
      );
    }
  });
});
