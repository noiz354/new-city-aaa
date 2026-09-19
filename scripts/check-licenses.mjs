// License gate (risk R-03): every installed package must carry an allowlisted
// license. GPL/AGPL-family licenses fail the build; unknown identifiers warn.
// Usage: node scripts/check-licenses.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const NM = join(ROOT, 'node_modules');
const ALLOW = new Set(['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'Unlicense', '0BSD', 'Python-2.0', 'MPL-2.0', 'BlueOak-1.0.0']);

function licenseOf(pkgDir) {
  try {
    const p = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    if (typeof p.license === 'string') return p.license;
    if (Array.isArray(p.licenses)) return p.licenses.map((l) => l.type).join(' OR ');
    return 'UNKNOWN';
  } catch {
    return 'UNREADABLE';
  }
}

const failures = [];
const warnings = [];
for (const entry of readdirSync(NM)) {
  if (entry.startsWith('.')) continue;
  const sub = entry.startsWith('@') ? readdirSync(join(NM, entry)).map((s) => join(entry, s)) : [entry];
  for (const name of sub) {
    const lic = licenseOf(join(NM, name));
    if (ALLOW.has(lic)) continue;
    if (/GPL|AGPL|LGPL|CPAL|EUPL|SSPL|BUSL/i.test(lic)) failures.push(`${name}: ${lic}`);
    else warnings.push(`${name}: ${lic}`);
  }
}
for (const w of warnings) console.warn(`LICENSE WARN ${w}`);
if (failures.length > 0) {
  for (const f of failures) console.error(`LICENSE FAIL ${f}`);
  process.exit(1);
}
console.log(`check-licenses OK (${warnings.length} warnings)`);
