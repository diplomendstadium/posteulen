import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/test/**/*.test.ts', 'backend/test/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    // Many tests run Argon2id (OPAQUE) several times; under full parallel load 5 s was too tight.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'json-summary'],
      include: ['shared/src/**/*.ts', 'backend/src/**/*.ts'],
      exclude: ['backend/src/dev/**', 'backend/src/main.ts', 'backend/src/cli.ts'],
      // SPEC 17.5: at least 90 % line coverage for crypto and game logic modules.
      thresholds: {
        // Per file, so a single weakly tested crypto module cannot hide in the average.
        'shared/src/**/*.ts': { lines: 90, perFile: true },
      },
    },
  },
});
