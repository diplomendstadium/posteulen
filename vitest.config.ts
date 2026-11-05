import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/test/**/*.test.ts', 'backend/test/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'json-summary'],
      include: ['shared/src/**/*.ts', 'backend/src/**/*.ts'],
      exclude: ['backend/src/dev/**', 'backend/src/main.ts', 'backend/src/cli.ts'],
      // SPEC 17.5: at least 90 % line coverage for crypto and game logic modules.
      thresholds: {
        'shared/src/**/*.ts': { lines: 90 },
      },
    },
  },
});
