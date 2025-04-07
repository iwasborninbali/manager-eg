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

// Start with the configurations from compat.extends
const eslintConfig = [
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    // Add other configuration objects here
    {
        files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"],
        // Optional: Add specific ignores if needed for the main config
        // ignores: ["some_other_ignored_pattern/**"], 
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        // Add any specific rules or settings for the main app files here
        // rules: { ... }
    },
    // Keep ignoring the functions directory if build happens separately
    {
        ignores: ["functions/**"]
    }
    // Add other distinct configuration objects if needed
];

export default eslintConfig;
