import js from "@eslint/js";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint, { parser as eslintParserTypeScript } from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "eslint.config.ts",
      "dist/**",
      "public/**",
      "api-server/target/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    plugins: {
      "better-tailwindcss": eslintPluginBetterTailwindcss,
    },
    languageOptions: {
      parser: eslintParserTypeScript,
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
      globals: {
        ...globals.node,
      },
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/main.css",
      },
    },
    rules: {
      ...eslintPluginBetterTailwindcss.configs.recommended.rules,
      ...eslintPluginBetterTailwindcss.configs.stylistic.rules,
      "better-tailwindcss/enforce-consistent-line-wrapping": ["off"],
      // 關閉未註冊/未知 class 的檢查，因為專案使用了很多自訂 class
      "better-tailwindcss/no-unregistered-classes": "off",
      "better-tailwindcss/no-unknown-classes": "off",
      // 允許以 _ 開頭的未使用參數（用於保留相容性的 API 介面）
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ["**/*.{js,cjs,mjs,jsx}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
);
