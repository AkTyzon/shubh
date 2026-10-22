/**
 * ESLint flat config.
 *
 * `eslint-config-next@16` ships native flat configs, so they are imported
 * directly. The scaffold wires them through `FlatCompat`, which is for
 * eslintrc-format configs and fails here while normalising the plugin graph.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // This app renders model output. Any raw-HTML injection point would need a
      // deliberate, reviewed exemption.
      "react/no-danger": "error",
    },
  },
];

export default config;
