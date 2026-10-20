# AR0234 - Plan

- Job: 2026-10-20-plan-ticket-spec-feature-586087e8
- Planned at: 1e11439a2ef6ddba59456d54837eb07b8adb4da6

## Approach
Owners list MCP servers once, under a new `mcp` option of the `orchestration` plugin, next to `coordinator` and `roles`. omp is handed those servers through files Arthur writes in its own folders. Nothing is written to `~/.omp` or into a project.

**How omp takes servers for one process.** I checked this with omp v18.3.0 and a throwaway stdio server in `/tmp`, which I removed afterwards:
- `omp --plugin-dir <dir>` loads `<dir>/.mcp.json`. `<dir>/.claude-plugin/plugin.json` must contain `{"name":"arthur"}`. omp then names the server `arthur:<server>` and its tools `mcp__arthur_<server>_<tool>`.
  - Command: `(sleep 4; echo '{"id":"s","type":"get_state"}') | omp --mode rpc --no-session --plugin-dir <dir>`. The server was started, and the system prompt listed `xd://mcp__arthur_mcp_probe_ping` (my probe's plugin was named `arthur-mcp`).
  - Print mode (`-p --mode json`) loads them too. Command: `OMP_MCP_REQUIRE_READY=1 omp -p --mode json --tools read,bash,grep,glob --plugin-dir <dir with a failing server> hi`. It printed `MCP server "arthur:down" failed to connect` and exited 1. Without `OMP_MCP_REQUIRE_READY`, a failed server is only a warning on stderr.
  - A value in a server's `env` that names an environment variable is resolved from omp's environment: `PROBE_TOKEN: "ARTHUR_PROBE_TOKEN"` reached the server as its value.
- **Problem with read-only roles.** By default omp shows MCP tools as `xd://` devices, which the agent calls through `write`. With `--tools read,bash,grep,glob` plus a server, `get_state` listed `read,bash,grep,glob,write`: omp added `write` to a read-only role. Without a server it listed `read,bash,grep,glob`.
- **The fix is a config overlay.** `--config <file>` holding `tools:\n  xdev: false` makes MCP tools ordinary tools that pass the `--tools` filter:
  - reviewer: `read,bash,grep,glob,mcp__arthur_mcp_probe_ping`
  - worker: `read,edit,write,bash,grep,glob,mcp__…`
  - A worker with no server shows no `xd://` devices either way, so the overlay only changes how MCP tools are presented.
- Listing `mcp__*` in `--tools` is refused (`Unknown tool in --tools`), and so is any name that is not loaded. That is why the plan uses the overlay and does not list MCP tools in `--tools`.

**What changes**
- **The option, in orchestration:**
  `mcp: { servers: { <name>: { command, args?, env? } | { url, headers? } }, all?: [names], roles?: { <role>: [names] } }`
  - `all` applies to every role.
  - A role key in `roles` (`coordinator`, `project`, `worker`, `reviewer`, …) replaces `all` for that role. `[]` gives that role none.
  - A secret in `env` or `headers` is written `{ valueEnv: "ARTHUR_ORCHESTRATION_<WHAT>" }`. The core's existing `...Env` resolution already finds a key ending in `Env` at any depth, requires the prefix, and refuses to start when the variable is missing (`findEnv`, `nameProblem` in `packages/core/src/env.ts`).
  - Refused at load, naming the path: a list naming an unknown server, and a server with neither or both of `command` and `url`.
- **Jobs.** Orchestration's `roles.model` answer gains `mcp`: that role's servers in omp's `mcpServers` shape, with secret values filled in from `host.env`. At spawn, `writeRecord` writes into the job record:
  - `mcp/.claude-plugin/plugin.json`
  - `mcp/.mcp.json` (mode 0600)
  - `mcp.yml`, holding the `tools.xdev: false` overlay

  `wrapper.ts` adds `--plugin-dir <record>/mcp --config <record>/mcp.yml` when `mcp/` exists, so `arthur continue` keeps them. `--tools` stays as it is.
- **Coordinator.** `supervise` writes `<home>/orchestration/mcp/` (0600) once per `arthur run` from the `coordinator` list, or `all`, and adds `--plugin-dir`. It needs no overlay: the coordinator has no `--tools` and keeps `write`.
- **Left alone:**
  - with no `mcp` option, every argument and file is exactly as today
  - the env guard, the worktree guard, skills, rules
  - the owner's own omp MCP config
  - Arthur never runs or proxies an MCP server itself.

Because of the gaps below, this plan follows Option 1 for the plugin API and Option A for project agents. Jobs placed on another machine get no servers until the remote-machine question is answered.

## Not available directly
- **The frozen plugin API has no way to carry a role's MCP servers.** `docs/plugin-api.md` freezes "a provided name's shape". The job's agent is started by the core's wrapper, and the only role data the core gets from orchestration is `roles.model` → `{ model, thinking, quick }`. A `jobs.prepare` can only return environment variables, gets a `kind` and not a role, and omp has no environment variable for a plugin directory (checked omp's `environment-variables.md`, `omp config list`, `cli-reference.md`).
  - Option 1: `roles.model` answer gains `mcp`. Cost: one row in "Provided names", about 15 core lines. Risk: any plugin that collects `roles.model` sees the resolved secrets in memory.
  - Option 2: a new provided name `roles.mcp`. Cost: one more row, plus a second copy of `roleModel`'s one-provider check. Risk: the same exposure.
  - Option 3: move the option to the core config. Cost: contradicts the ticket ("in the plugin that owns roles"). Risk: the coordinator's start would need core options.
  - Recommendation: Option 1.
- **Project agents do not exist yet.** They are roadmap entry 85, and neither `packages/orchestration/src` nor the board has them, so no project agent can be started with servers now.
  - Option A: accept and check `mcp.roles.project` now, and add to entry 85 that its agent starts with that list. Cost: one roadmap line. Risk: that Done point stays untested until entry 85.
  - Option B: hold this ticket until entry 85. Cost: delays MCP for the coordinator and jobs. Risk: none.
  - Recommendation: Option A.

## Files
- `packages/orchestration/src/mcp.ts` (new):
  - the `mcp` option-table entry
  - `checkMcp` (unknown names, `command`/`url`, value shapes)
  - `mcpServers(options, env, role)`: the role's list or `all`, resolved into omp's shape (`type: "http"` for a `url`)
  - `writeMcp(folder, servers)`: write to a temporary name and rename, 0600
- `packages/orchestration/src/orchestration-options.ts`: `table.mcp`; `checkOptions` calls `checkMcp`.
- `packages/orchestration/src/spawn-rules.ts`: the `roles.model` provider adds `mcp` for job roles. It does not add it for `coordinator`, which `supervise` handles.
- `packages/orchestration/src/coordinator.ts`, `orchestration.ts`: `supervise` gets the coordinator's servers, writes `<folder>/mcp/` (removed when there are none), and adds `--plugin-dir`.
- `packages/core/src/roles.ts`: `roleModel` checks and returns `mcp` (undefined, or an object of objects).
- `packages/core/src/job-record.ts`: `writeRecord(..., mcp?)` writes `mcp/` and `mcp.yml` inside the temporary record before the rename.
- `packages/core/src/jobs.ts`: passes `preset.mcp` for a local job. For a job on another machine it writes none, and the spawn's warnings name the servers left out.
- `packages/core/src/remote-job.ts`: updates the `writeRecord` call (no MCP).
- `packages/core/src/wrapper.ts`: about two lines adding `--plugin-dir` and `--config` (194 → about 196, under the 200-line cap).
- `docs/plugin-api.md`: the `roles.model` row becomes `{ model, thinking, quick, mcp }`, only after the human approves.
- `packages/core/docs/commands/roles.md`, `spawn.md`: the `mcp` answer; the record's `mcp/` and `mcp.yml`; the two flags.
- `packages/orchestration/docs/commands/coordinator.md`:
  - Options gains `mcp`
  - step 4 gains `--plugin-dir`
  - a new section "MCP servers" with both shapes (global only; global plus a reviewer of its own) and `valueEnv`
- `arthur.config.example.ts`: an `mcp` block with `all` and `roles: { reviewer: [...] }`, and a comment showing the global-only form.
- `packages/orchestration/test/options.test.ts`, `spawn-rules.test.ts`, `coordinator.test.ts`; `packages/core/test/wrapper.test.ts` or `roles.test.ts`.
- `test/structure.test.ts`: raise the budgets, with the reason in the comment and as a decision in the ticket. Core is at 5684 of 5684 (about +15); orchestration is at 1431 of 1433 (about +90).
- `spec/roadmap.md` entry 85: its agent starts with `mcp.roles.project`'s servers.
- `CHANGELOG.md`.

## Risks
- **A read-only role could gain `write`.** The `tools.xdev: false` overlay prevents it; the probe above shows `read,bash,grep,glob` plus only the MCP tool.
- **The secret sits in a file.** It is in `<record>/mcp/.mcp.json` (0600) until `arthur prune` deletes the record, and the job's own tools can read it, as they could read its environment.
  - It stays out of `prompt`, `task`, `log` (which logs only the path in argv) and every other record file.
  - The worktree guard already refuses writes into the home folder, so the agent cannot change the file.
- **Answers are visible to other plugins.** Resolved secrets travel in the `roles.model` answer, which another plugin can collect (Option 1's risk). The coordinator's servers are never put in that answer.
- **omp's value rules.** A value that starts with `!` is run by omp as a shell command, and a plain value equal to a variable name is replaced by that variable (omp's `mcp-config.md`). The doc page says both.
- **omp's error text.** That omp's own connect errors in the log never contain header values is an [INFERENCE] from omp's lifecycle doc ("without leaking resolved tokens"); I did not test it.
- **No regression with no option.** The exact-argument tests in `wrapper.test.ts` (lines 107 and 139) and `coordinator.test.ts` stay as they are and must pass.
- **Line limits.** `wrapper.ts` and `jobs.ts` are close to 200 lines; the change adds at most 3 lines to each.

## How to test
- **One option; global versus per role:** `options.test.ts` and `spawn-rules.test.ts`, collecting `roles.model` per role:
  - with `all` only, `reviewer` gets those servers
  - `roles.reviewer: ["docs"]` beats `all`
  - `roles.reviewer: []` gives no `mcp`, and the spawned record has no `mcp/`
- **Coordinator, project agent and jobs get their servers:**
  - coordinator: `coordinator.test.ts` checks that the fake agent's `starts.jsonl` args contain `--plugin-dir <home>/orchestration/mcp`, and that `.mcp.json` holds exactly the coordinator's servers.
  - jobs: a core test spawns a `review` job against the fake agent and checks the args: `--tools read,bash,grep,glob` unchanged, plus `--plugin-dir <record>/mcp --config <record>/mcp.yml`. It also checks that `.mcp.json` holds exactly the reviewer's servers and `mcp.yml` holds `tools.xdev: false`.
  - project agent: deferred to entry 85 (Open questions).
- **How omp takes the servers:** the commands and their results are under Approach. As a smoke run, the worker runs `omp --mode rpc --tools read,bash,grep,glob --plugin-dir <record>/mcp --config <record>/mcp.yml` on a spawned record with a throwaway stdio server, and reads `get_state`'s tools.
- **Unknown names and incomplete servers are refused at load:** `options.test.ts` checks `mcp.roles.reviewer` with an unknown name, `mcp.all` with an unknown name, a server with neither `command` nor `url`, and one with both, each named by its path.
- **The secret stays out of the job's files:** `fakeHost` with `env: { ARTHUR_ORCHESTRATION_DOCS_TOKEN: "s3cret" }` spawns a job that runs to its end. Every file under the record is read recursively, and `s3cret` appears only in `mcp/.mcp.json`. The env guard tests are unchanged.
- **No `mcp` option, start as today:** the existing exact-argument tests pass unchanged, plus one assertion that the record has no `mcp/` and the coordinator's folder has no `mcp/`.
- **`docs/plugin-api.md`:** changed only by the one row, after approval.
- **Docs and example:** the example mirror in `options.test.ts` gains the `mcp` block and passes.
- **Checks:** `npm test` and `npm run check`.

## Open questions
- **Approve the plugin API change:** the `roles.model` answer gains `mcp`, the resolved servers of the role (Option 1). This also means raising the line budgets: core about +15, orchestration about +90.
- **Project agents:** do they get `mcp.roles.project` when roadmap entry 85 builds them (Option A), rather than this ticket waiting for entry 85?
- **Jobs on another machine:** the vision says Arthur sends another machine no secret. The plan's default is that a job on another machine starts with no MCP server and its spawn warns, naming them. Should it instead get the servers without a secret, or all of them?
