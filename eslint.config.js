// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const featureBoundary = {
  group: ["@/features/*", "@/features/**"],
  message: "Features must not import other features. Move shared code to components/, hooks/ or lib/ (or @shared)."
};

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "docs/**", "**/*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  },

  /* ---------- API ---------- */
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: { "no-console": ["error", { allow: ["warn", "error"] }] }
  },
  {
    // The domain layer is pure: no database, HTTP or framework code.
    files: ["apps/api/src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/modules/*", "@/http/*", "@/core/*", "@prisma/client", "express"], message: "Keep domain/ pure: pass data in instead." }] }]
    }
  },
  {
    // Modules talk to each other only through their index.ts public API.
    files: ["apps/api/src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/modules/*/*"], message: "Import another module through its index (e.g. @/modules/bookings)." }] }]
    }
  },
  {
    files: ["apps/api/prisma/seed.ts"],
    rules: { "no-console": "off" }
  },

  /* ---------- Web ---------- */
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-console": "error"
    }
  },
  {
    // Feature isolation: a feature imports shared layers, never another feature (bulletproof-react).
    files: ["apps/web/src/features/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [featureBoundary] }] }
  },
  {
    // Shared layers sit below features and the app shell.
    files: ["apps/web/src/{components,hooks,lib}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [featureBoundary, { group: ["@/app/*"], message: "Shared code must not depend on the app shell." }] }]
    }
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" }
  },

  /* ---------- Shared ---------- */
  {
    // The shared package has no app or framework dependencies.
    files: ["packages/shared/src/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/*", "react", "express", "@prisma/client"], message: "packages/shared must stay framework-free." }] }] }
  },

  prettier
);
