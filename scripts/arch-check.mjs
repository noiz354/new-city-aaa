// Architecture import-graph check (module-boundaries.md). Fails CI on violation.
// Usage: node scripts/arch-check.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

// module of a file, or null for exempt files (tests, config-adjacent)
function moduleOf(relPath) {
  if (relPath.endsWith('.test.ts')) return null;
  if (relPath === 'main.ts' || relPath === 'vite-env.d.ts') return 'main';
  const top = relPath.split(sep)[0];
  if (['shared', 'sim', 'workers', 'view', 'ui', 'persistence', 'testing'].includes(top)) return top;
  return null;
}

// allowed target modules per importer (deny-by-default)
const ALLOWED = {
  shared: new Set([]),
  sim: new Set(['shared']),
  workers: new Set(['shared']),
  view: new Set(['shared']),
  'ui/plain': new Set(['shared']),
  'ui/react': new Set(['shared', 'ui/plain']),
  persistence: new Set(['shared', 'workers']),
  testing: new Set(['shared', 'sim', 'persistence']),
  main: new Set(['shared', 'sim', 'workers', 'view', 'ui/plain', 'ui/react', 'persistence', 'testing']),
};

function submoduleOf(relPath) {
  const m = moduleOf(relPath);
  if (m === 'ui') return relPath.startsWith(`ui${sep}react${sep}`) ? 'ui/react' : 'ui/plain';
  return m;
}

function targetModuleOfImport(importerDir, spec) {
  if (!spec.startsWith('.')) return null; // bare imports handled by eslint
  const parts = join(importerDir, spec).split(sep);
  const srcIdx = parts.lastIndexOf('src');
  const top = parts[srcIdx + 1];
  if (top === 'ui') {
    const next = parts[srcIdx + 2] ?? '';
    return next === 'react' ? 'ui/react' : 'ui/plain';
  }
  return ['shared', 'sim', 'workers', 'view', 'persistence', 'testing'].includes(top) ? top : null;
}

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) yield p;
  }
}

const errors = [];
const warnings = [];
for (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  const from = submoduleOf(rel);
  // soft file-size cap (warn only)
  const text = readFileSync(file, 'utf8');
  // `import type` is erased at compile time: no runtime coupling, always allowed
  const code = text
    .split('\n')
    .filter((l) => !/^\s*import\s+type[\s{]/.test(l))
    .join('\n');
  const lines = text.split('\n').length;
  if (lines > 300 && !rel.endsWith('.test.ts')) warnings.push(`${rel}: ${lines} lines (soft cap 300)`);
  if (from === null) continue;
  const allowed = ALLOWED[from] ?? new Set();
  const dir = join(SRC, rel.split(sep).slice(0, -1).join(sep));
  for (const m of code.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)) {
    const target = targetModuleOfImport(dir, m[1]);
    if (target !== null && target !== from && !allowed.has(target)) {
      errors.push(`${rel} [${from}] imports ${m[1]} [${target}] — forbidden`);
    }
  }
  // testing/ may only be imported by tests, perf, e2e (checked: any non-test src import is an error)
  if (from !== 'testing') {
    for (const m of code.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]*testing[^'"]*)['"]/g)) {
      errors.push(`${rel}: imports testing helper '${m[1]}' from non-test source`);
    }
  }
}

for (const w of warnings) console.warn(`WARN ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`ARCH VIOLATION ${e}`);
  process.exit(1);
}
console.log(`arch-check OK (${[...walk(SRC)].length} files)`);
