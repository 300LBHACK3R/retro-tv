import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".vercel/**",
    "node_modules/**",

    ".history/**",
    "coverage/**",
    ".turbo/**",
    ".cache/**",
    "tsconfig.tsbuildinfo",

    "next-env.d.ts",

    "**/*.before-*",
    "**/*.backup-*",
    "**/*.repair-backup-*",
    "**/* copy.*",
    "**/* Copy.*",
  ]),

  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;