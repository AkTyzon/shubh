import type { NextConfig } from "next";

/**
 * Security headers, set here rather than at the platform so they travel with the
 * repository and apply identically in local development.
 *
 * **On `'strict-dynamic'`.** It is absent deliberately. Adding it to `script-src`
 * makes a browser ignore `'self'` and `'unsafe-inline'` entirely and trust only
 * scripts carrying the matching nonce or hash. Next's App Router emits no nonce
 * unless middleware generates one per request, so with `'strict-dynamic'` every
 * script is fetched with a 200 and then refused by the browser: the page renders,
 * and nothing on it works. It is a bad failure because the HTML is fine — curl
 * sees a perfect response, because curl neither executes scripts nor enforces
 * CSP. Checking a CSP change requires a real browser, every time.
 *
 * `'unsafe-inline'` is required for the inline bootstrap script the App Router
 * emits. The honest mitigation is not a nonce we do not have: it is that this
 * application renders no HTML from user or model input anywhere —
 * `dangerouslySetInnerHTML` appears nowhere in the codebase and CI fails the
 * build if it is introduced.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Fonts are downloaded at build time by next/font and served from this origin,
  // so no external font host needs to be allowed.
  "font-src 'self' data:",
  "img-src 'self' data:",
  // The browser talks only to this origin. Model calls are made server-side, so
  // a key never needs to reach the client and an exfiltration path would be
  // visible here as a widened directive.
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle, which keeps the deployed function
  // small and the cold start short on a free tier.
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No feature here needs any of these, so all are denied rather than
          // left to the browser default.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
