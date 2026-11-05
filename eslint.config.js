// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './web/svelte.config.js';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'web/src/generated/',
      'tools/map/.cache/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
          message: 'innerHTML/outerHTML sind verboten (SPEC 6).',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'insertAdjacentHTML ist verboten (SPEC 6).',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        extraFileExtensions: ['.svelte'],
        parser: tseslint.parser,
        svelteConfig,
      },
    },
    rules: {
      'svelte/no-at-html-tags': 'error',
      'svelte/no-inline-styles': 'error',
      'svelte/no-target-blank': 'error',
    },
  },
  {
    files: [
      'backend/src/cli.ts',
      'scripts/**/*.ts',
      'web/scripts/**/*.ts',
      'deploy/**/*.ts',
      'tools/**/*.ts',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    // Tests and the offline map tool may assert values they just created.
    files: ['**/test/**/*.ts', 'e2e/**/*.ts', 'tools/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
