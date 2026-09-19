# Skill Activation Strategy

> How skills get discovered and invoked — with minimal overhead and no doc-spam.

## 1. Discovery mechanism

- **Location:** `.agents/skills/<name>/SKILL.md` — the open Agent Skills standard (verified at agentskills.io). This single project-scope location is recognized by Claude Code, Codex, Cursor, VS Code, and OpenCode (all list skills.sh support; skills.sh installs into the repository).
- **No agent binaries exist in this environment**, so runtime auto-invocation is configured by convention, not tested against a live agent (recorded honestly in [verification-results](verification-results.md)).
- **AGENTS.md** (project root) holds the concise routing table + hard constraints. It does not paste skill contents.
- Agent-specific alternatives (`.claude/skills/`, `.codex/skills/`) are documented here only — skills are intentionally not duplicated.

## 2. Progressive disclosure (spec-compliant)

1. **Startup:** agent reads `name` + `description` only (~100 tokens × 18 skills ≈ 1.8k tokens — negligible).
2. **Activation:** full SKILL.md loads when the task matches triggers or `skill-task-mapping.md`.
3. **Deep:** `rules/`, `references/`, `scripts/`, `examples/` load on demand (e.g., one three.js rule file, not all 28; `--help` before reading `with_server.py`).

## 3. Invocation rules

- The router (`AGENTS.md` + [skill-task-mapping](skill-task-mapping.md)) names the skill(s) per task; `city-builder-roadmap-executor` enforces minimal loading per slice.
- Cross-skill references resolve by name: `tdd` → `codebase-design` (installed); matt `code-review` mentions → `code-review-and-quality` (addy equivalent, installed); `webapp-testing` underpins all browser customs.
- `browser-testing-with-devtools` activates **only** when a chrome-devtools MCP server is configured; otherwise browser work routes to `webapp-testing`.
- Server-side (RSC/Next.js) rules inside `vercel-react-best-practices` and R3F patterns anywhere are explicitly out of scope (AGENTS.md constraints).

## 4. Overhead guards

- No skill loads another skill's full body speculatively; customs reference project docs by path (resolved and checked).
- Rule-heavy skills (three.js, react) are consulted per-rule via their quick-reference indexes.
- MCP/credentials: nothing installed requires credentials; no MCP server was configured (blocker logged for the DevTools skill).
