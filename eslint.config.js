import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// The rule set is deliberately narrow to start with: it has to pass on a
// 90,000-line codebase that has never been linted, so it covers the mistakes
// that actually break this app — bad hook dependencies, undefined variables,
// unreachable code — and leaves style alone. Tighten it over time rather than
// turning it off when it gets noisy.
export default [
  {
    ignores: [
      'dist/**', 'android/**', 'ios/**', 'node_modules/**', 'public/**',
      '.firebase/**', 'src/components/AmiriFont.js', 'codemod-*.cjs',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.2' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // JSX does not need React in scope with the automatic runtime.
      'react/react-in-jsx-scope': 'off',
      // This codebase does not use propTypes; it would be thousands of warnings.
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',

      // The two that matter most here: a missing dependency is how stale data
      // and infinite render loops get shipped.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Native dialogs are replaced by src/components/dialogs.jsx. This keeps
      // them from coming back.
      'no-alert': 'error',

      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_|^React$',
        ignoreRestSiblings: true,
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',

      // Pre-existing hygiene issues, ~20 of them across the codebase. They are
      // worth cleaning up but none of them is a live bug, and leaving them as
      // errors would mean the CI gate could never be switched on. Demoted to
      // warnings so the gate starts working today; promote them back to 'error'
      // as each one is cleared.
      'no-case-declarations': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-catch': 'warn',
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
    },
  },
  {
    // Node scripts and config files.
    files: ['*.config.js', '*.cjs', 'scripts/**/*.js', 'server.js', 'electron.js', 'preload.js', 'set-first-admin.js', 'fix-capgo.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
