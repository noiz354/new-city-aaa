// Flat config: type-aware rules + sim purity (T-043) + module import rules (G-A11).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const noWallClock = {
  'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator', 'setInterval', 'setTimeout', 'requestAnimationFrame', 'Date'],
  'no-restricted-syntax': [
    'error',
    { selector: 'MemberExpression[object.name="Math"][property.name="random"]', message: 'sim: use seeded Rng, never Math.random' },
    { selector: 'MemberExpression[object.name="performance"][property.name="now"]', message: 'sim: time must be injected, never read directly' },
    { selector: 'CallExpression[callee.name="setInterval"]', message: 'sim: no wall-clock timers' },
    { selector: 'CallExpression[callee.name="setTimeout"]', message: 'sim: no wall-clock timers' },
  ],
};

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'perf/results.json', 'perf/baseline.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  // sim + workers: no render/UI frameworks, no wall clock, no DOM (T-043 / ADR-01)
  {
    files: ['src/sim/**/*.ts', 'src/workers/**/*.ts'],
    rules: {
      ...noWallClock,
      'no-restricted-imports': ['error', { paths: ['three', 'react', 'react-dom'], patterns: ['three/*', 'react-*', '@react-*'] }],
    },
  },
  // view: three.js allowed, React forbidden (except nothing — canvas mount lives in ui/)
  {
    files: ['src/view/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: ['react', 'react-dom'], patterns: ['react-*'] }] },
  },
  // react UI: React allowed, three.js forbidden
  {
    files: ['src/ui/react/**/*'],
    rules: { 'no-restricted-imports': ['error', { paths: ['three'], patterns: ['three/*'] }] },
  },
  // tests may use anything (mocks, timers, DOM-less helpers)
  { files: ['**/*.test.ts', 'e2e/**/*', 'perf/**/*', 'scripts/**/*'], rules: { ...Object.fromEntries(Object.keys(noWallClock).map((k) => [k, 'off'])) } },
);
