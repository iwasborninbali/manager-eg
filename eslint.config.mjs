import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"],
    // ignores: ["functions/**"], // Keep ignoring functions here
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node
        }
    }
  },
  // Delete the block below starting from here
  // {
  //   files: ["functions/src/**/*.ts"],
  //   languageOptions: {
  //     globals: {
  //       ...globals.node,
  //     },
  //     parserOptions: {
  //         project: ["./functions/tsconfig.json"],
  //     },
  //   },
  //   plugins: {
  //     "@typescript-eslint": tseslint.plugin,
  //   },
  //   rules: {
  //       ...tseslint.configs.recommended.rules,
  //       "no-console": "off",
  //   },
  // }
  // Delete the block above up to here
];

export default eslintConfig;
