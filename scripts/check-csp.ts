/**
 * Assert the Content-Security-Policy this app actually serves.
 *
 * Checks the header value the config produces, not the text of the file. An
 * earlier version of this guard grepped `next.config.ts` for "strict-dynamic"
 * and failed on the comment *explaining why strict-dynamic is absent* — which is
 * the same class of mistake as a secret scanner that trips on documentation.
 *
 *   npx tsx scripts/check-csp.ts
 */

import config from "../next.config";

/**
 * Directives that must be present, and the one token that must not.
 *
 * `'strict-dynamic'` makes a browser ignore `'self'` and `'unsafe-inline'` and
 * trust only scripts carrying a matching nonce or hash. The App Router emits no
 * nonce unless middleware generates one per request, so adding it serves every
 * script with a 200 and then has the browser refuse it: the page renders and
 * nothing on it works. `curl` cannot see this — it neither executes scripts nor
 * enforces CSP — which is exactly why this is an automated check.
 */
const REQUIRED = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
];

const FORBIDDEN = ["strict-dynamic", "unsafe-eval", "*"];

async function main(): Promise<void> {
  if (typeof config.headers !== "function") {
    throw new Error("next.config.ts defines no headers() function.");
  }

  const groups = await config.headers();
  const headers = groups.flatMap((group) => group.headers);

  const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value;
  if (!csp) throw new Error("No Content-Security-Policy header is configured.");

  const problems: string[] = [];

  for (const directive of REQUIRED) {
    if (!csp.includes(directive)) problems.push(`missing directive: ${directive}`);
  }

  for (const token of FORBIDDEN) {
    // Matched against the directive list rather than the whole string, so
    // `*` does not false-positive on something like `data:`.
    const present = csp
      .split(";")
      .some((directive) => directive.trim().split(/\s+/).slice(1).includes(token));
    if (present) problems.push(`forbidden token present: ${token}`);
  }

  // The other headers this app depends on. Each has bitten some deployment
  // somewhere; none is expensive to assert.
  for (const key of [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    if (!headers.some((header) => header.key === key)) problems.push(`missing header: ${key}`);
  }

  if (problems.length > 0) {
    console.error("FAIL: the served security headers are wrong:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`\nCSP as configured:\n  ${csp}`);
    process.exit(1);
  }

  console.log("Security headers OK. CSP as served:");
  console.log(`  ${csp}`);
}

void main();
