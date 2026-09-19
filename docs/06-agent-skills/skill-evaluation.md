# Skill Evaluation

> Every verdict below is grounded in an inspected SKILL.md (or a documented excerpt). Compatibility = Agent Skills standard format; no agent binary exists in this sandbox, so runtime invocation is verified by convention + metadata, and execution only where tooling exists (§8 of the brief).

## 1. Installed public skills (13)

| Skill | Source @ pinned SHA | License | Deps | Capability for this game | Key evidence (read) | Limitations | Recommendation |
|-------|---------------------|---------|------|--------------------------|---------------------|-------------|----------------|
| three-best-practices | emalorenzo/three-agent-skills@`f950f95a` | MIT | none | Vanilla three.js perf: instancing, dispose, draw calls, LOD, TSL/WebGPU rules | 334-line SKILL.md, 28 rule files, three 0.182+; `geometry-instanced-mesh` verified good | 162 quick-ref items but only 28 detail files (checklist > guide); single maintainer | **Install** (repo docs win on conflicts) |
| vercel-react-best-practices | vercel-labs/agent-skills@`063bee94` | MIT | none | React perf rules (rerender/bundle/js) for HUD panels | 149-line SKILL.md + 74 rule files, all cross-refs resolve | ~40% of rules are Next.js/RSC-only → excluded by AGENTS.md | **Install** (client-side subset) |
| vercel-composition-patterns | vercel-labs/agent-skills@`063bee94` | MIT | none | Compound components, no boolean-prop sprawl for toolbar/inspector/panels | Full SKILL.md: composition-first, React 19 notes | Guidance only, no scripts | **Install** |
| webapp-testing | anthropics/skills@`34040c9c` | Apache-2.0 | py-playwright + Chromium | Real-browser E2E: screenshots, console logs, UI flows; `with_server.py` manages dev servers | 95-line SKILL.md + stdlib-only helper (verified `--help` runs) + 3 examples | Python-side only; browser launch needs OS libs (blocked in sandbox) | **Install** (primary browser tool) |
| spec-driven-development | addyosmani/agent-skills@`c004a747` | MIT | none | Gated Specify workflow incl. boundaries/success criteria | 251 lines; Overview/When to Use/Rationalizations/Red Flags/Verification present | Generic (not game-specific) | **Install** |
| planning-and-task-breakdown | addyosmani/agent-skills@`c004a747` | MIT | none | Small verifiable tasks with acceptance criteria | 257 lines, same anatomy | Generic | **Install** |
| code-review-and-quality | addyosmani/agent-skills@`c004a747` | MIT | none | 5-axis pre-merge review (correctness/readability/arch/security/perf) | 396 lines, "approve on improvement" standard | Review guidance, not automation | **Install** |
| performance-optimization | addyosmani/agent-skills@`c004a747` | MIT | profiler of choice | Measure-first discipline; pairs with our perf-gate | 496 lines | Backend/query sections N/A (ignored per mapping) | **Install** |
| frontend-ui-engineering | addyosmani/agent-skills@`c004a747` | MIT | none | Accessible, responsive, non-generic UI incl. state handling | 328 lines, WCAG-aware | Web-page framing; game HUD adapted via mapping | **Install** |
| browser-testing-with-devtools | addyosmani/agent-skills@`c004a747` | MIT | **chrome-devtools MCP + Chrome (absent)** | DevTools-driven DOM/console/network/perf inspection | 317 lines; explicitly requires MCP server | Unexecutable here; guidance value only until MCP configured | **Install** (gated) |
| tdd | mattpocock/skills@`c55ee460` | MIT | none (+codebase-design vocab) | TS red-green loop: seams-first, anti-patterns (tautological/coupled tests) | 38-line SKILL.md + tests.md + mocking.md | References `codebase-design` (installed) and matt `code-review` (routed to addy equivalent) | **Install** |
| diagnosing-bugs | mattpocock/skills@`c55ee460` | MIT | none | Feedback-loop ladder: failing test → replay → fuzz → bisect; secret redaction | 138 lines + HITL template script | Template script is human-in-the-loop (last resort) | **Install** |
| codebase-design | mattpocock/skills@`c55ee460` | MIT | none | Deep-module vocabulary (module/interface/seam/depth) for testable design | Head verified; matches our module-boundaries doc | Vocabulary, not procedure | **Install** (tdd dependency) |

## 2. Rejected or deferred

| Skill | Verdict | Reason (evidence-based) |
|-------|---------|-------------------------|
| r3f-best-practices | **Reject** | R3F/Poimandres-only (frontmatter verified); conflicts with ADR-U1 (vanilla Three.js, React outside loop) |
| threejs-pro, threejs-scene-builder, react-three-webgl, three-js (mindrally) | **Reject** | Directory excerpts show R3F/Next.js/Tailwind/marketing-site focus; stack mismatch. Full SKILL.md not pulled (rejection basis documented, nothing installed) |
| vercel-optimize | **Reject** | Requires Vercel CLI + login + linked project (prerequisites read); platform + credential mismatch |
| openai/skills contents | **Reject** | Repo README declares deprecation; points to openai/plugins |
| web-design-guidelines | **Defer** | Fetches remote rules at every use (network dependency, unpinned); overlaps frontend-ui-engineering |
| frontend-design (anthropics) | **Defer** | Landing-page aesthetics (hero/typography); mismatched to HUD dashboards; overlaps frontend-ui-engineering |
| agent-browser | **Defer** | SKILL.md is a stub requiring global Rust CLI + Chrome (`npm i -g`); overlaps webapp-testing; revisit if Playwright proves insufficient |
| addy test-driven-development, debugging-and-error-recovery | **Defer** | Direct overlap with matt tdd/diagnosing-bugs, which are TS-specific and сильнее for sim debugging |
| addy remaining 17 | **Defer** | Need-based: incremental-implementation (covered by roadmap-executor), git/security/observability/etc. (install when the slice needs them) |
| matt rest (implement, research, grill-me, …) | **Defer** | Overlap (implement→roadmap-executor+tdd) or out of scope (exercises, questionnaires) |

## 3. Selection criteria applied (§4)

Relevance to VS-0…VS-7 first; standard-format compatibility (all); instruction quality verified by reading; execution ability preferred (webapp-testing over agent-browser); trusted maintainers (Vercel/Anthropics/Addy/Matt + 1 verified community author); overlap eliminated (one skill per job; cross-refs routed via AGENTS.md); overhead minimal (16→18 skills, ~100 tokens startup each); reproducibility (pinned SHAs, no remote installers).
