# AR0670 - A herdr plugin: each running job is a pane in herdr on the server, with its live activity and its state in the sidebar

```json
{
  "id": "AR0670",
  "title": "A herdr plugin: each running job is a pane in herdr on the server, with its live activity and its state in the sidebar",
  "date": "2026-11-09"
}
```

## Description

The owner wants to SSH to the server, open herdr (the agent-aware terminal workspace, herdr.dev, 0.9.3 already in `~/.local/bin/herdr`) and see every agent Arthur runs. Today a job is a headless `omp -p --mode json` in a systemd scope, with no screen: herdr cannot show it. This ticket adds a live, readable view of one job in a terminal, and a `herdr` plugin that opens one such pane per job and reports its state to herdr's sidebar.

## Goal

Asked by the owner on 2026-11-09 ("when i ssh to the serwer and open the herdr i can see all agents that are working"). Evidence: `packages/core/src/wrapper.ts:82` runs the agent with `-p --mode json`, so its only output is the job's `log` (JSON lines) and `activity`; `arthur jobs` lists states but shows no live work. herdr 0.9.3 offers `herdr workspace create`, `herdr pane run` and `herdr pane report-agent` (its socket API), which a plugin can call as a local process: nothing listens, nothing leaves the machine (vision, "Arthur exposes nothing").

- Plan: yes

- Kind: feat

## Done means

- `arthur jobs --follow <id>` (name final in the plan) prints a job's run as readable lines as it happens: each tool call with its main argument, the agent's text, the state changes, and ends when the job ends; read-only, from the job's own files, no model.
- With the `herdr` plugin on and herdr's server running on the machine: each job that starts gets a pane in an `arthur` workspace (one tab per project or per job, as the plan decides), titled with its ticket, kind and short id, running the follow view; its state is reported to herdr (`working`, `blocked` with its reason, done) so the sidebar shows which job needs the owner; the pane closes or is marked done when the job is pruned. herdr not installed or not running: the plugin does nothing and says so once in `arthur doctor`, never failing a spawn.
- A pane with `arthur attach` for the coordinator is part of the workspace.
- Docs and roadmap (the owner asked for both): `packages/herdr/docs/herdr.md` says how to set herdr up on the server and what each pane and state means; the follow view has its `--help` page; `spec/roadmap.md` has a numbered entry for the plugin, marked done when it merges; the vision's plugin table lists `herdr`; the README's plugin list names it.
- Tests against the fake host and a fake `herdr` on `PATH` that answers as herdr 0.9.3's documentation shows; `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- The follow view (core or orchestration, as the plan decides) and its doc page.
- `packages/herdr/`: the new plugin, its doc, its tests and its first line budget (the owner's decision, in the plan).
- `arthur.config.example.ts`, `spec/vision.md` (plugin table), `spec/roadmap.md`: the new plugin.

Out:
- Running jobs inside herdr as interactive agents: jobs stay headless in their systemd scope, with their guards and limits.
- Jobs on other machines: local first; the plan says if herdr's `--machine` covers them later.

## Decisions
- 2026-11-09: AR0670 approved, its plan runs right after AR0663; docs and roadmap updated with it; the owner: "AR-D587 - 1 - remembert to add this to docs and roadmap" (AR-D587)

