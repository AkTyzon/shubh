/**
 * Generates the decorative SVG artwork.
 *
 * The art is generated rather than drawn by hand for three reasons: intricate
 * radial symmetry is tedious and error-prone to write by hand, the output is
 * reproducible so a palette change is a one-line edit and a re-run, and the
 * result is a handful of kilobytes of vector rather than a photograph nobody
 * wants to download on an Indian mobile connection.
 *
 * Every piece is decorative. None of it carries information, all of it is
 * `aria-hidden` or `alt=""` where it is used, and the page reads identically
 * with images disabled.
 *
 *   npx tsx scripts/generate-art.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "art");

/** Polar to cartesian, with 0° at twelve o'clock. */
function at(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * A rangoli.
 *
 * Concentric rings of petals, teardrops and dots at twelve-fold symmetry — the
 * structure an actual doorstep rangoli uses. Drawn in a single warm gold so it
 * tints cleanly with opacity over either the light or the dark surface.
 */
function rangoli(): string {
  const size = 600;
  const c = size / 2;
  const parts: string[] = [];

  // Outer lotus petals.
  const petals = 12;
  for (let i = 0; i < petals; i += 1) {
    const angle = (360 / petals) * i;
    const [tipX, tipY] = at(c, c, 282, angle);
    const [leftX, leftY] = at(c, c, 196, angle - 15);
    const [rightX, rightY] = at(c, c, 196, angle + 15);
    const [baseX, baseY] = at(c, c, 168, angle);
    parts.push(
      `<path d="M${round(baseX)} ${round(baseY)} Q${round(leftX)} ${round(leftY)} ${round(tipX)} ${round(tipY)} Q${round(rightX)} ${round(rightY)} ${round(baseX)} ${round(baseY)} Z" opacity="0.5"/>`,
    );
  }

  // A ring of dots between the petal tips.
  for (let i = 0; i < petals; i += 1) {
    const [x, y] = at(c, c, 246, (360 / petals) * i + 360 / petals / 2);
    parts.push(`<circle cx="${round(x)}" cy="${round(y)}" r="5" opacity="0.75"/>`);
  }

  // Scalloped middle ring.
  const scallops = 24;
  const scallopPath: string[] = [];
  for (let i = 0; i <= scallops; i += 1) {
    const angle = (360 / scallops) * i;
    const [x, y] = at(c, c, 160, angle);
    const [mx, my] = at(c, c, 178, angle - 360 / scallops / 2);
    scallopPath.push(i === 0 ? `M${round(x)} ${round(y)}` : `Q${round(mx)} ${round(my)} ${round(x)} ${round(y)}`);
  }
  parts.push(`<path d="${scallopPath.join(" ")} Z" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.65"/>`);

  // Inner teardrops.
  const drops = 8;
  for (let i = 0; i < drops; i += 1) {
    const angle = (360 / drops) * i;
    const [tipX, tipY] = at(c, c, 142, angle);
    const [leftX, leftY] = at(c, c, 96, angle - 13);
    const [rightX, rightY] = at(c, c, 96, angle + 13);
    const [baseX, baseY] = at(c, c, 72, angle);
    parts.push(
      `<path d="M${round(baseX)} ${round(baseY)} Q${round(leftX)} ${round(leftY)} ${round(tipX)} ${round(tipY)} Q${round(rightX)} ${round(rightY)} ${round(baseX)} ${round(baseY)} Z" opacity="0.8"/>`,
    );
  }

  // Centre flower.
  const centre = 6;
  for (let i = 0; i < centre; i += 1) {
    const angle = (360 / centre) * i;
    const [x, y] = at(c, c, 34, angle);
    parts.push(`<circle cx="${round(x)}" cy="${round(y)}" r="22" opacity="0.5"/>`);
  }
  parts.push(`<circle cx="${c}" cy="${c}" r="16" opacity="0.95"/>`);

  // Two plain guide rings, as a real rangoli has.
  parts.push(`<circle cx="${c}" cy="${c}" r="196" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="296" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.28"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="currentColor" color="#d9873f" role="presentation"><g>${parts.join("")}</g></svg>`;
}

/**
 * A toran — the hanging garland strung across a doorway at every Indian
 * celebration. Repeats horizontally, so it tiles across a full-width band.
 */
function toran(): string {
  const width = 240;
  const height = 72;
  const parts: string[] = [];

  // The string, sagging between two fixings.
  parts.push(
    `<path d="M0 10 Q${width / 4} 30 ${width / 2} 10 Q${(width * 3) / 4} 30 ${width} 10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5"/>`,
  );

  // Alternating marigolds and leaves hanging from it.
  const hangs = 12;
  for (let i = 0; i <= hangs; i += 1) {
    const t = i / hangs;
    const x = t * width;
    // Follow the sag of the string.
    const sag = Math.sin(t * Math.PI * 2) * 10;
    const y = 10 + Math.abs(sag);

    if (i % 2 === 0) {
      // A marigold: a ring of small circles around a centre.
      const cy = y + 20;
      for (let p = 0; p < 8; p += 1) {
        const [px, py] = at(x, cy, 7, (360 / 8) * p);
        parts.push(`<circle cx="${round(px)}" cy="${round(py)}" r="5" opacity="0.85"/>`);
      }
      parts.push(`<circle cx="${round(x)}" cy="${round(cy)}" r="4.5" opacity="1"/>`);
      parts.push(`<line x1="${round(x)}" y1="${round(y)}" x2="${round(x)}" y2="${round(cy - 10)}" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>`);
    } else {
      // A mango leaf.
      const top = y + 8;
      parts.push(
        `<path d="M${round(x)} ${round(top)} Q${round(x - 9)} ${round(top + 16)} ${round(x)} ${round(top + 30)} Q${round(x + 9)} ${round(top + 16)} ${round(x)} ${round(top)} Z" opacity="0.7"/>`,
      );
      parts.push(`<line x1="${round(x)}" y1="${round(y)}" x2="${round(x)}" y2="${round(top)}" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="currentColor" color="#e09a3e" role="presentation">${parts.join("")}</svg>`;
}

/**
 * A jaali lattice — the pierced stone screen in Indian architecture.
 *
 * Replaced an attempted paisley, whose inner cut rendered as a plain ring rather
 * than the hooked teardrop it was meant to be. A lattice is the better choice
 * anyway: it tiles seamlessly in both directions, which a scattered motif does
 * not, and at the very low opacity it is used at it reads as texture rather than
 * as a pattern competing with the text.
 */
function jaali(): string {
  const size = 80;
  const parts: string[] = [];
  const half = size / 2;

  // Two overlapping squares make the eight-pointed star of a classic jaali.
  // Drawn at the centre and at all four corners so the tile joins seamlessly.
  const star = (cx: number, cy: number, r: number, opacity: number) => {
    const square = (rotate: number) =>
      `<rect x="${round(cx - r)}" y="${round(cy - r)}" width="${round(r * 2)}" height="${round(r * 2)}" ` +
      `transform="rotate(${rotate} ${round(cx)} ${round(cy)})" fill="none" stroke="currentColor" ` +
      `stroke-width="1.6" opacity="${opacity}"/>`;
    return square(0) + square(45);
  };

  parts.push(star(half, half, 17, 0.9));
  for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size]]) {
    parts.push(star(x, y, 17, 0.9));
  }

  // Connecting diagonals, which is what turns separate stars into a lattice.
  parts.push(
    `<path d="M0 ${half} L${half} 0 M${half} 0 L${size} ${half} M${size} ${half} L${half} ${size} M${half} ${size} L0 ${half}" ` +
      `fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.45"/>`,
  );

  for (const [x, y] of [[half, 0], [0, half], [size, half], [half, size]]) {
    parts.push(`<circle cx="${x}" cy="${y}" r="2" opacity="0.7"/>`);
  }
  parts.push(`<circle cx="${half}" cy="${half}" r="3" opacity="0.85"/>`);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ` +
    `fill="currentColor" color="#b9763a" role="presentation">${parts.join("")}</svg>`
  );
}

/**
 * A mandap arch, used as a framing element.
 *
 * Scalloped inner edge with a finial, which is the shape a wedding mandap or a
 * temple doorway actually has.
 */
function arch(): string {
  const width = 400;
  const height = 300;
  const parts: string[] = [];

  // The arch outline: two uprights and a scalloped curve across the top.
  const scallops = 9;
  const path: string[] = [`M40 ${height}`, `L40 150`];
  for (let i = 0; i <= scallops; i += 1) {
    const t = i / scallops;
    const x = 40 + t * (width - 80);
    const y = 150 - Math.sin(t * Math.PI) * 110;
    const px = 40 + (t - 0.5 / scallops) * (width - 80);
    const py = y - 14;
    path.push(i === 0 ? `L${round(x)} ${round(y)}` : `Q${round(px)} ${round(py)} ${round(x)} ${round(y)}`);
  }
  path.push(`L${width - 40} ${height}`);
  parts.push(`<path d="${path.join(" ")}" fill="none" stroke="currentColor" stroke-width="3" opacity="0.8"/>`);

  // A finial at the apex.
  parts.push(`<circle cx="${width / 2}" cy="32" r="9" opacity="0.9"/>`);
  parts.push(`<path d="M${width / 2} 12 L${width / 2 + 7} 30 L${width / 2} 44 L${width / 2 - 7} 30 Z" opacity="0.8"/>`);

  // Hanging bells along the inside of the arch.
  for (let i = 1; i < scallops; i += 1) {
    const t = i / scallops;
    const x = 40 + t * (width - 80);
    const y = 150 - Math.sin(t * Math.PI) * 110 + 8;
    parts.push(`<line x1="${round(x)}" y1="${round(y)}" x2="${round(x)}" y2="${round(y + 14)}" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>`);
    parts.push(`<circle cx="${round(x)}" cy="${round(y + 19)}" r="4" opacity="0.75"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor" color="#d9873f" role="presentation">${parts.join("")}</svg>`;
}

const FILES: Record<string, string> = {
  "rangoli.svg": rangoli(),
  "toran.svg": toran(),
  "jaali.svg": jaali(),
  "arch.svg": arch(),
};

for (const [name, contents] of Object.entries(FILES)) {
  writeFileSync(join(OUT, name), contents);
  console.log(`  ${name.padEnd(14)} ${(contents.length / 1024).toFixed(1)} KB`);
}
console.log(`\n${Object.keys(FILES).length} decorative SVGs written to public/art.`);
