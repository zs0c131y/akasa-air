import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

/**
 * Lint rules for the whole repo. `npm run lint` checks, `npm run lint:fix` repairs what it can.
 * The client also gets accessibility rules (jsx-a11y) and the React hooks rules.
 */
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', 'data/**', 'client/public/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: '18.3' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/label-has-associated-control': ['error', { depth: 4 }],
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
    },
  },
  // Label is the shared wrapper that pages use with htmlFor, so the rule cannot see the control from inside it.
  { files: ['client/src/ui/input.jsx'], rules: { 'jsx-a11y/label-has-associated-control': 'off' } },
  { files: ['client/**/*.test.{js,jsx}', 'client/src/test-setup.js'], languageOptions: { globals: { ...globals.vitest } } },
  { files: ['**/*.test.js', 'server/test/**'], languageOptions: { globals: { ...globals.vitest } } },
  {
    files: ['scripts/**/*.mjs', 'client/tailwind.config.js', 'client/postcss.config.js', 'client/vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
];
