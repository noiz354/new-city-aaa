# Agent Skills — Discovery, Evaluation & Installation

> The coding agent's capability layer for building this game. No game code was touched: this track installs and configures **skills only**, following the open Agent Skills standard (`.agents/skills/<name>/SKILL.md`).

## Contents

- [skill-discovery](skill-discovery.md) — environment findings, sources searched, candidate inventory (24 skills)
- [skill-evaluation](skill-evaluation.md) — per-skill evidence tables: capability, license, deps, limits, verdict
- [installation-manifest](installation-manifest.md) — what was installed, from which pinned revision, where, and its verification status
- [skill-task-mapping](skill-task-mapping.md) — task → skill and roadmap-slice → skill routing
- [skill-activation-strategy](skill-activation-strategy.md) — discovery, progressive disclosure, invocation rules, overhead
- [custom-skills](custom-skills.md) — 5 project-specific skills and the gaps they fill
- [verification-results](verification-results.md) — per-skill verification evidence (metadata, integrity, execution)
- [security-review](security-review.md) — what was audited, findings, permissions granted (none), blockers

## At a glance

- **Installed:** 13 public skills (pinned SHAs, MIT/Apache-2.0 only) + 5 custom skills = **18 skills** in `.agents/skills/`
- **Routing:** `AGENTS.md` (project root) — load only what the task needs
- **Rejected/deferred:** 11+ candidates with documented reasons (R3F conflicts, platform mismatch, overlap, deprecated, heavyweight deps)
- **Rule:** skills are guidance + tools, not proof — every slice still needs measured evidence per `docs/05-execution/definition-of-done.md`

## Adding or removing a skill later

1. Evaluate per [skill-evaluation](skill-evaluation.md) criteria (read the actual SKILL.md; check license + deps + overlap).
2. Copy the reviewed directory at a pinned SHA into `.agents/skills/` + `UPSTREAM.json` (source, revision, date, license). Never run remote installers.
3. Update the manifest, task mapping, `AGENTS.md` routing, and this index. Verify per [verification-results](verification-results.md) procedure.
