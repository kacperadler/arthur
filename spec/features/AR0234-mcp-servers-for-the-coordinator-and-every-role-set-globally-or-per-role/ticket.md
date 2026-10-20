# AR0234 - MCP servers for the coordinator and every role, set globally or per role

```json
{
  "id": "AR0234",
  "title": "MCP servers for the coordinator and every role, set globally or per role",
  "date": "2026-10-20"
}
```

## Description

Arthur has no MCP of its own: every agent it runs is `omp`. The coordinator and a project agent run as interactive `omp` and see whatever MCP servers omp's own config gives them, unchosen by Arthur. A job runs with a fixed `--tools` list (`packages/core/src/wrapper.ts:18-19`, `read,edit,write,bash,grep,glob` for a worker, without edit/write for a reviewer), so a job most likely gets no MCP tool at all [unverified]. The owner wants MCP for the coordinator and for the workers, and to choose in `arthur.config.ts` whether every role gets the same servers or each role (reviewer, worker, ...) its own.

## Goal

The owner lists MCP servers once in the config and says which go to everyone and which to a given role; the coordinator, each project agent, and each job get exactly those, and nothing else from Arthur.

- Kind: feature
- Plan: tak

## Done means

- One config option (in the plugin that owns roles, next to `coordinator`/`roles`): MCP servers defined once by name, a global list applied to all, and a per-role list (`coordinator`, `project`, `worker`, `reviewer`, `planner`, `auditor`, `retro`, `onboarding`) that replaces the global one for that role. Tested: the global list reaches a role without its own; a role's own list wins over the global one; an empty role list gives that role none.
- The coordinator and a project agent get their servers; a job gets its role's servers and their tools pass the job's `--tools` filter, a read-only role keeps its read-only built-ins. Tested against the fake agent: the arguments or config the agent is started with carry exactly the role's servers.
- How omp takes the servers per process (a config file in the job's folder, an env var, or a flag) is found first and written in the plan with the command that showed it; nothing writes into the owner's own `~/.omp` or the project's files.
- An unknown server name in a role list, or a server without a command/url, is refused when Arthur loads, naming it. Tested.
- A server's secret (a token in its env or header) stays out of the job's prompt, log and record; the env guard still keeps `.env` from the agent. Tested: the token is absent from the job folder's files except the one the agent reads.
- With no MCP option set, everything starts as today. Tested.
- `docs/plugin-api.md` is unchanged unless the frozen host API must grow; if it must, that is asked first.
- The option's doc page and `arthur.config.example.ts` show both shapes (global only; global plus a reviewer of its own).
- `npm test` and `npm run check` pass.

## Scope

In:
- The roles/orchestration config and its docs, `packages/core/src/wrapper.ts` (how a job's agent is started), the coordinator's and project agent's start, `arthur.config.example.ts`.

Out:
- Arthur running or proxying MCP servers itself; skills and rules (omp already loads them, unchanged).

## Decisions

- 2026-10-20: Owner: the coordinator and the workers must have MCP; the config lets him give everyone the same servers or each role (reviewer, worker, ...) its own.
- 2026-10-20: Owner approved; it starts after AR0232, after the usage reset.
- 2026-10-20: Plan approved by the human: plan.md at 4c8ada2. With it: Option 1 (the `roles.model` answer gains `mcp`; one row of docs/plugin-api.md; line budgets core about +15, orchestration about +90); Option A (accept `mcp.roles.project` now, entry 85 wires it); a job on another machine starts with no MCP server and its spawn warns, naming them.
