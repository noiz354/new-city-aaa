# Skill Discovery

> Date: 2026-09-19. Method: environment inspection → source sweep → inventory. Nothing installed in this phase.

## 1. Existing agent configuration (inspected, not assumed)

| Item | Finding |
|------|---------|
| Coding agent binary | **None** — no `codex`, `opencode`, or other agent CLIs installed |
| Skill directories (global + project) | **None exist** — no `.agents/`, `.claude/`, `.codex/`, `.opencode/` anywhere |
| `AGENTS.md` | **None** (created by this track) |
| MCP servers / plugins | **None** configured |
| Toolchain | node v20.20.2, npm 10.8.2, Python 3.13.14, git 2.47.3 |
| Browsers / Playwright | Absent initially; Python Playwright + Chromium headless-shell installed into user cache **for verification only** (not persisted, not a project dependency) |
| Roadmap / research docs | `spec.md`, `plan.md`, `tasks.md`, `docs/00–05` (this track's capability source) |

Consequence: install location follows the **open Agent Skills standard** (`.agents/skills/`, verified at agentskills.io): the single project-scope location recognized across Claude Code, Codex, Cursor, VS Code, and OpenCode (all list skills.sh support). No global install (no global config exists; project scope is the default). Agent-specific alternatives are documented, not duplicated.

## 2. Sources searched

- https://skills.sh/ (+ per-agent pages for Codex, OpenCode) — directory + leaderboard
- https://github.com/vercel-labs/agent-skills, https://github.com/anthropics/skills, https://github.com/openai/skills, https://github.com/vercel-labs/agent-browser (all cloned `--depth 1`, SHAs in manifest)
- https://github.com/addyosmani/agent-skills (cloned; our established workflow basis)
- https://github.com/mattpocock/skills (cloned; TS-focused)
- https://github.com/emalorenzo/three-agent-skills (cloned; found via three.js skills search)
- Web searches: three.js/R3F/WebGL agent skills; game-dev + Playwright skills; threejs-pro, threejs-scene-builder, react-three-webgl, three-js/mindrally directory listings (excerpts only)

## 3. Candidate inventory (24)

| # | Skill | Source | Domain | Evidence depth | Disposition |
|---|-------|--------|--------|----------------|-------------|
| 1 | three-best-practices | emalorenzo/three-agent-skills | A/B three.js | Full SKILL.md + rules sample | **Install** |
| 2 | r3f-best-practices | emalorenzo/three-agent-skills | A (R3F) | Frontmatter + headers | Reject (R3F vs ADR-U1) |
| 3 | vercel-react-best-practices | vercel-labs/agent-skills | D React | Full SKILL.md + cross-refs | **Install** |
| 4 | vercel-composition-patterns | vercel-labs/agent-skills | D React | Full SKILL.md | **Install** |
| 5 | web-design-guidelines | vercel-labs/agent-skills | D UI review | Full (39 lines) | Defer (network fetch + overlap) |
| 6 | vercel-optimize | vercel-labs/agent-skills | E perf | Headers + prereqs | Reject (Vercel platform + login) |
| 7 | webapp-testing | anthropics/skills | E browser | Full + scripts + license | **Install** |
| 8 | frontend-design | anthropics/skills | D aesthetics | Head + license | Defer (off-domain + overlap) |
| 9 | agent-browser | vercel-labs/agent-browser | E browser | Full stub | Defer (heavy CLI + overlap) |
| 10–15 | addy ×6 (spec, planning, review, perf, frontend-ui, devtools-testing) | addyosmani/agent-skills | F + E | Frontmatter + anatomy | **Install** |
| 16–17 | addy tdd, debugging | addyosmani/agent-skills | F | Frontmatter | Defer (overlap w/ matt pair) |
| 18+ | addy remaining 17 | addyosmani/agent-skills | F | README table | Defer (scope/need-based) |
| 19 | tdd | mattpocock/skills | F testing | Full + refs | **Install** |
| 20 | diagnosing-bugs | mattpocock/skills | E/F debug | Full + script | **Install** |
| 21 | codebase-design | mattpocock/skills | F design | Full head | **Install** (tdd dependency) |
| 22 | matt rest (implement, research, …) | mattpocock/skills | F | Headers | Defer (overlap/scope) |
| 23 | openai/skills contents | openai/skills | — | README | Reject (repo deprecated) |
| 24 | threejs-pro, threejs-scene-builder, react-three-webgl, three-js | directories | A/B | Excerpts only | Reject (R3F/Next/marketing focus) |
| 25–29 | 5 custom skills | this repo | D/E/F | Authored here | **Install** (custom) |

Full per-skill verdicts: [skill-evaluation](skill-evaluation.md).
