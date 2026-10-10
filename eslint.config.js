import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'supabase/functions',
      'src/lib/database.types.ts',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  // Safari drops list semantics from a <ul> with list-style: none (Tailwind's reset), so role="list" is not redundant there.
  { files: ['**/*.tsx'], rules: { 'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }] } },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
    languageOptions: { globals: globals.browser },
  },
  { files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'public/**/*.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // Workbook parsing is a local script (scripts/ledger-*.mjs); it must never reach the browser bundle.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'exceljs', message: 'exceljs is for the local ledger scripts only.' }] }],
    },
  },
);
