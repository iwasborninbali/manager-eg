import globals from "globals";
import js from "@eslint/js"; // Импортируем базовый JS конфиг
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  // Базовые рекомендованные правила ESLint
  js.configs.recommended,

  // Конфигурация TypeScript без tseslint.configs
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node, // Node.js environment
        ...globals.es2021, // Modern ES features
      },
      parser: tsParser, // Явно указываем парсер
      parserOptions: {
        project: "./tsconfig.json", // Указываем путь к tsconfig
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin, // Явно указываем плагин
    },
    rules: {
      // Берем правила из рекомендованного набора плагина
      ...tsPlugin.configs.recommended.rules,
      // Ваши кастомные правила или переопределения
      "quotes": ["error", "double"],
      "object-curly-spacing": ["error", "always"],
      "indent": ["error", 2],
      "max-len": ["warn", { "code": 120, "ignoreUrls": true }],
      // Правила из google стиля, если нужны (адаптированы):
      "require-jsdoc": "off",
      "valid-jsdoc": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      // 'no-console': 'off', // Раскомментируйте, если нужен console.log
    },
  },

  // Секция игнорирования
  {
    ignores: [
      "lib/", // Игнорируем папку с JS бандлом
      "node_modules/",
    ],
  }
];
