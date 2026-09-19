# Research Methodology

> How evidence was gathered, graded, and traced into decisions. All research artifacts live in `docs/00-research/`; the full citation table is [source-registry.md](source-registry.md).

## 1. Method

1. **Discover** — inspect the local repo first (see [repository-implementation-audit](../01-audit/repository-implementation-audit.md)); the repo is the source of truth for "what exists".
2. **Search** — web search across official docs, engineering blogs, GitHub, papers, and postmortems (2026-09-19).
3. **Inspect code** — shallow-clone (`--depth 1` into scratch, never into the project) and read the actual files behind every architectural claim: `dgreenheck/simcity-threejs-clone`, `SimHacker/micropolis`, `ijrdn/divercity`, `Citybound/Citybound`, plus raw-file reads of `OpenTTD/OpenTTD` (`yapf_base.hpp`, `saveload.h`) and `OpenRCT2/OpenRCT2` (`Game.cpp`), and `mrdoob/three.js` (`InstancedMesh.js`, releases page).
4. **Grade** — every finding is labeled (see §3) before it may influence a decision.
5. **Trace** — decisions in `docs/02-architecture/` cite registry IDs (e.g. `S-08`); the audit in `docs/01-audit/` maps each gap to the evidence that proves it.

## 2. What was NOT done

- No benchmarks were executed (no implementation exists to measure). All numbers in this audit are **budgets or capacity models**, never measured results — see [performance-budgets](../04-performance/performance-budgets.md).
- No proprietary code or assets were copied. GPL/AGPL sources were read for concepts only (clean-room rule, [adr](../01-audit/technical-risk-register.md#r-03-license-contamination-gplagpl)).
- `andrewmcwatters/openrct2` (a reference suggested in the audit brief) **could not be verified**; the canonical `OpenRCT2/OpenRCT2` was used instead and the substitution is documented in [city-builder-reference-projects](city-builder-reference-projects.md#7-openttdopentrct2-note).

## 3. Evidence grades

| Grade | Meaning | May support |
|-------|---------|-------------|
| **F — Verified fact** | Read directly from primary source (official docs, fetched source file) | Hard decisions, budgets |
| **C — Code-demonstrated** | Behavior observed in inspected source (file + revision recorded) | Algorithm choice, API usage |
| **B — Benchmark-backed** | Reproducible numbers from a cited benchmark | Performance claims (**none claimed in this audit**) |
| **R — Recommendation** | Engineering judgment combining F/C findings | Defaults, gates, process |
| **H — Hypothesis** | Plausible but unmeasured; needs a spike | Marked `HYPOTHESIS`, never a gate |

Rule: no `H` finding may appear in a roadmap completion condition; each `H` maps to a benchmark task in [benchmark-scenarios](../04-performance/benchmark-scenarios.md).

## 4. Traceability convention

- Sources: `S-01…S-N` in [source-registry.md](source-registry.md).
- Findings: `F-<doc>-<n>` inline where needed.
- Risks: `R-01…` in [technical-risk-register](../01-audit/technical-risk-register.md).
- Prior docs: [spec](../../spec.md), [plan](../../plan.md), [tasks](../../tasks.md), prior gap analyses `../08-gap-analysis-github.md`, `../09-gap-analysis-v2-code.md` remain valid inputs and are cited as `PRIOR-*` where reused.
