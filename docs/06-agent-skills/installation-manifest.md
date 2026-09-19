# Installation Manifest

> Scope: `.agents/skills/` (project). Method: reviewed directories copied from pinned shallow clones + `UPSTREAM.json` provenance each. No remote installers executed (`npx skills add` deliberately not used — see [security-review](security-review.md)). Upstream dirs kept pristine except two renames for spec compliance (`name` must equal directory).

## Installed public skills (13)

| Skill (dir) | Source | Pinned revision | License | Dependencies | Verification |
|-------------|--------|-----------------|---------|--------------|--------------|
| three-best-practices | https://github.com/emalorenzo/three-agent-skills | `f950f95a` (2026-09-19) | MIT | none | metadata ✓, partial rule coverage noted |
| vercel-react-best-practices | https://github.com/vercel-labs/agent-skills | `063bee94` (2026-09-19) | MIT | none | metadata ✓, 74 rules resolve ✓ (renamed from `react-best-practices`) |
| vercel-composition-patterns | https://github.com/vercel-labs/agent-skills | `063bee94` (2026-09-19) | MIT | none | metadata ✓, rules resolve ✓ (renamed from `composition-patterns`) |
| webapp-testing | https://github.com/anthropics/skills | `34040c9c` (2026-09-19) | Apache-2.0 | py-playwright + Chromium | metadata ✓, `--help` ✓, headless screenshot ✓ |
| spec-driven-development | https://github.com/addyosmani/agent-skills | `c004a747` (2026-09-19) | MIT | none | metadata ✓, anatomy ✓ |
| planning-and-task-breakdown | https://github.com/addyosmani/agent-skills | `c004a747` (2026-09-19) | MIT | none | metadata ✓, anatomy ✓ |
| code-review-and-quality | https://github.com/addyosmani/agent-skills | `c004a747` (2026-09-19) | MIT | none | metadata ✓, anatomy ✓ |
| performance-optimization | https://github.com/addyosmani/agent-skills | `c004a747` (2026-09-19) | MIT | profiler of choice | metadata ✓, anatomy ✓ |
| frontend-ui-engineering | https://github.com/addyosmani/agent-skills | `c004a747` (2026-09-19) | MIT | none | metadata ✓, anatomy ✓ |
| browser-testing-with-devtools | https://github.com/addyosmani/agent-skills | `c004a747` (2026-09-19) | MIT | chrome-devtools MCP + Chrome (**absent**) | metadata ✓, execution blocked (logged) |
| tdd | https://github.com/mattpocock/skills | `c55ee460` (2026-09-19) | MIT | none (+`codebase-design`) | metadata ✓, refs resolve ✓ |
| diagnosing-bugs | https://github.com/mattpocock/skills | `c55ee460` (2026-09-19) | MIT | none | metadata ✓, script reviewed ✓ |
| codebase-design | https://github.com/mattpocock/skills | `c55ee460` (2026-09-19) | MIT | none | metadata ✓, refs resolve ✓ |

## Installed custom skills (5, authored in-repo, MIT)

`city-builder-visual-qa`, `city-builder-simulation-audit`, `city-builder-performance-gate`, `city-builder-playability-test`, `city-builder-roadmap-executor` — v1.0.0 each; metadata ✓; all cited doc paths resolve ✓. Rationale: [custom-skills](custom-skills.md).

## Excluded from copies

Distribution `.zip` files at upstream `skills/` roots (redundant). Nothing else removed; no files modified upstream-side.

## Reproducing this install

```bash
# for each row: git clone --depth 1 <source> && git fetch --depth 1 origin <sha> && git checkout <sha>
# then copy the reviewed skill dir to .agents/skills/<skill-name>/ + write UPSTREAM.json
```

Full SHAs: emalorenzo `f950f95ae3b13581546e6d6d8b2f88a08eb3e577`, vercel `063bee94c3f4df8453406c830b0a7df0f2860278`, anthropics `34040c9c568585f6929bedeaad110ad08f079624`, addy `c004a74784a08295d52749b04cda634125b9a581`, mattpocock `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`.
