# Security Review

> Nothing here runs with privilege, talks to the network unexpectedly, or touches credentials.

## 1. Method

- Sources cloned over HTTPS from the 7 named orgs; SHAs pinned and recorded (`UPSTREAM.json` per skill).
- **No remote installers executed**: `npx skills add` / `curl|bash` deliberately avoided; installation = local `cp` of reviewed trees.
- Grep audits for `curl|wget|sudo|rm -rf /|password|api[_-]?key|token` across all installed skill code: **clean** (one `tokenizer` false positive excluded).
- Every executable file read before install (3 total — see §2).

## 2. Findings per executable

| File (skill) | Behavior | Verdict |
|--------------|----------|---------|
| `webapp-testing/scripts/with_server.py` | stdlib-only (`subprocess/socket/argparse`); starts **localhost** dev servers, waits on ports, runs a given command, tears down | Safe by design; agent must only pass reviewed server commands (it's a local-process spawner, not a sandbox) |
| `diagnosing-bugs/scripts/hitl-loop.template.sh` | Interactive prompts (`read`), prints `KEY=VALUE`; no network, no destructive ops | Safe; human-in-the-loop last resort |
| (no other executables) | All other skills are guidance-only (Markdown + YAML metadata) | Nothing to execute |

- `agents/openai.yaml` files (matt skills): display metadata only.
- Deferred-skill risks (not installed, for the record): `web-design-guidelines` fetches remote rules per use (unpinned network); `agent-browser` wants a global install + broad `allowed-tools`; `vercel-optimize` needs CLI login. Deferrals stand.

## 3. Permissions granted

**None.** No credentials created or requested, no global npm packages, no MCP servers configured, no filesystem grants beyond the project tree, no services enabled.

## 4. Environment notes (not project changes)

- `pip install playwright` + `playwright install-deps` (passwordless sudo present in sandbox) + Chromium download went to user cache / system libs — **verification aids only**, outside the persisted project tree, not project dependencies. CI and dev machines provision these via documented steps at VS-1.
- Supply-chain residual: skills are pinned vendored copies; updating = re-review + re-pin (never blind pull). Upstream LICENSEs preserved (MIT/Apache-2.0 texts checked; per-skill `license` frontmatter retained).
