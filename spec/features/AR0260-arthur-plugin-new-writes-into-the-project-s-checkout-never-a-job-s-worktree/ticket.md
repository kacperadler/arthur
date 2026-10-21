# AR0260 - `arthur plugin new` writes into the project's checkout, never a job's worktree

```json
{
  "id": "AR0260",
  "title": "`arthur plugin new` writes into the project's checkout, never a job's worktree",
  "date": "2026-10-21"
}
```

## Description

the command writes into the checkout of the main project or the one `--project` names, as listed in `arthur.config.ts`, the way `arthur changelog` does. The CLI loads `arthur.config.ts` from its working folder, which a job's worktree does not have (it is gitignored), so the worker on a new plugin's ticket cannot run `arthur plugin new` on its own branch; the coordinator or the owner running it leaves the new package uncommitted in the main checkout, outside any job and review. Seen by reading `cli.ts:58` (`loadConfig("arthur.config.ts")`) and `.gitignore`; not run inside a job.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: improvement

Evidence:
- `packages/develop/src/plugin-new.ts` (`pluginCommand`), `packages/core/src/cli.ts:58`
- Found by: 2026-10-21-ar0256-roadmap-66-plugin-18c71d6b (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: let a job run it on its worktree: a `--root <path>` limited to a job's own worktree (from `ARTHUR_JOB`'s record), or the coordinator's role naming the command only as the first step of a worker's task. Out: changing where `arthur.config.ts` is read.
- `npm test` and `npm run check` pass.

## Scope

In:
- let a job run it on its worktree: a `--root <path>` limited to a job's own worktree (from `ARTHUR_JOB`'s record), or the coordinator's role naming the command only as the first step of a worker's task. Out: changing where `arthur.config.ts` is read.

## Decisions

- 2026-10-21: Source: F1 of AR0256
