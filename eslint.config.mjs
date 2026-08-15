import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Restates eslint-config-next's own defaults, which are dropped once this key is set.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    /*
     * An underscore prefix means "this parameter exists because the signature requires it, and
     * is deliberately unused". The codebase already reads that way — every server action takes
     * `_previous` because `useActionState` passes the previous state whether or not the action
     * cares — so the linter is taught the convention rather than the code being bent around it.
     *
     * Only `args`, not variables or caught errors: an unused local is usually a mistake, and
     * silencing those by prefix would hide it.
     */
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^$" },
      ],
    },
  },
]);

export default eslintConfig;
