// ESLint flat config: TypeScript rules + Playwright best-practice rules.
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  { ignores: ['node_modules', 'reports', 'test-results', 'playwright-report', 'blob-report', 'all-blob-reports', '.auth', 'learning', 'eslint.config.mjs'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Catches a missing "await": the #1 cause of flaky Playwright tests.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-focused-test': 'error', // test.only must never reach CI
      'playwright/no-wait-for-timeout': 'error', // no sleeps
      'playwright/no-wait-for-selector': 'error', // use web-first assertions instead
      'playwright/no-skipped-test': 'warn', // skips need a reason / ticket
      'playwright/missing-playwright-await': 'error',
      'playwright/expect-expect': ['error', { assertFunctionNames: [] }],
      'playwright/prefer-locator': 'off', // our page objects already wrap locators (false positives on .fill())
    },
  },
);
