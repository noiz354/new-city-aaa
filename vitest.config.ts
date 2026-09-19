import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'perf/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**/*.ts', 'src/shared/**/*.ts', 'src/persistence/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 80, branches: 70, functions: 80 },
    },
  },
});
