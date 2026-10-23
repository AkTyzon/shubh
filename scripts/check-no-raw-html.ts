/**
 * Assert that no HTML is ever rendered from user or model input.
 *
 * This is the mitigation that makes `'unsafe-inline'` acceptable in the CSP. The
 * App Router needs it for its bootstrap script, so the honest defence is not a
 * nonce we do not have — it is that nothing in this application turns a string
 * into markup. Model output goes through `react-markdown`, which builds React
 * elements, so the worst a hostile model achieves is odd-looking text.
 *
 * **Comments are stripped before scanning, and that is the point.** The previous
 * version of this guard was a `grep` over raw source, and it failed on the
 * comment in `components/MarkdownView.tsx` explaining why `innerHTML` is *not*
 * used. That is the second guard in this project to trip on its own
 * documentation — the CSP check did the same thing — and the lesson both times
 * is that a guard should assert the behaviour, not the text of the file. Writing
 * down why a dangerous API is avoided has to remain free.
 *
 *   npx tsx scripts/check-no-raw-html.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "lib", "components", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

/** The APIs that turn a string into live markup. */
const FORBIDDEN: { pattern: RegExp; what: string }[] = [
  { pattern: /dangerouslySetInnerHTML/, what: "dangerouslySetInnerHTML" },
  { pattern: /\.innerHTML\s*=/, what: "innerHTML assignment" },
  { pattern: /\.outerHTML\s*=/, what: "outerHTML assignment" },
  { pattern: /insertAdjacentHTML\s*\(/, what: "insertAdjacentHTML" },
  { pattern: /document\.write\s*\(/, what: "document.write" },
  // `eval` and `new Function` are not HTML, but they are the other way a string
  // becomes code, and the CSP forbids 'unsafe-eval' on the same reasoning.
  { pattern: /\beval\s*\(/, what: "eval" },
  { pattern: /new\s+Function\s*\(/, what: "new Function" },
];

function sourceFiles(dir: string): string[] {
  let found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found = found.concat(sourceFiles(path));
    else if (EXTENSIONS.has(extname(entry))) found.push(path);
  }
  return found;
}

/**
 * Remove comments so documentation can discuss a dangerous API freely.
 *
 * Block comments go first. Line comments are then removed only where the `//` is
 * at the start of a line or preceded by whitespace, and is not the `//` of a
 * URL scheme — otherwise `https://example.test` would truncate a line of real
 * code and could hide a genuine usage sitting after it.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => {
      const match = /(^|\s)\/\/(?!\/)/.exec(line);
      if (!match) return line;
      // Guard against a scheme: only treat it as a comment if the characters
      // before the slashes are not a colon.
      const index = match.index + match[1].length;
      if (line[index - 1] === ":") return line;
      return line.slice(0, index);
    })
    .join("\n");
}

function main(): void {
  const problems: string[] = [];
  let scanned = 0;

  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      // This file necessarily names every pattern it looks for.
      if (file.endsWith("check-no-raw-html.ts")) continue;

      scanned += 1;
      const code = stripComments(readFileSync(file, "utf8"));

      code.split("\n").forEach((line, index) => {
        for (const { pattern, what } of FORBIDDEN) {
          if (pattern.test(line)) {
            problems.push(`${relative(".", file)}:${index + 1} — ${what}`);
          }
        }
      });
    }
  }

  if (problems.length > 0) {
    console.error("FAIL: a string is being turned into markup or code:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nModel and user input must never be rendered as HTML. This is what makes " +
        "'unsafe-inline' acceptable in the CSP.",
    );
    process.exit(1);
  }

  console.log(
    `No raw HTML or code injection points in ${scanned} source files. ` +
      `Comments were stripped first, so documenting why these APIs are avoided stays free.`,
  );
}

main();
