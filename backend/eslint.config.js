// @ts-check
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const globals = require('globals')

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.local-pgdata/**', 'storage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Type-aware linting for the real application code — catches real bugs
    // (floating promises, unsafe `any` flow, etc.) that syntax-only rules
    // can't. Scoped to src/ because tsconfig.json's "include" is src-only.
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Consistent with tsconfig's noUnusedLocals/noUnusedParameters, but
      // this project's established convention (see reports.repository.ts,
      // simulator.service.ts) is to prefix an intentionally-unused
      // destructured/catch param with `_` rather than drop it — allow that.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // tests/ and prisma/seed.ts are intentionally excluded from
    // tsconfig.json's "include" — lint these on syntax/style rules only,
    // without type-aware parserOptions (no tsconfig covers them as a
    // program). tseslint's recommended config already turns off the
    // base no-undef for .ts files (TS itself catches undefined
    // identifiers, and no-undef doesn't understand ambient/global types),
    // so these just need the parser, not Node globals.
    files: ['tests/**/*.ts', 'prisma/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Plain CommonJS config files — unlike .ts, no-undef stays active here
    // (tseslint's override only applies to TS files), so `require`,
    // `module`, `__dirname` etc. need Node's CommonJS globals explicitly.
    files: ['eslint.config.js', '*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      // Justified exception, not a blanket suppression: this file is
      // necessarily CommonJS (package.json has "type": "commonjs", and
      // ESLint's own flat-config loader requires config files to be
      // requireable synchronously) — `require()` here is correct, not a
      // legacy pattern to discourage.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Dev-only helper scripts (see scripts/local-db.mjs) — plain ESM,
    // same no-undef consideration as above.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['vitest.config.mts'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
      globals: globals.node,
    },
  },
)
