# AR0298 - On another machine the checkout a job reaches has no arthur.config.ts, so the line of `arthur plugin new` cannot run there

```json
{
  "id": "AR0298",
  "title": "On another machine the checkout a job reaches has no arthur.config.ts, so the line of `arthur plugin new` cannot run there",
  "date": "2026-10-22"
}
```

## Description

the planner's and the worker's section, as `plugin.md` before it, says to run `cd <checkout> && arthur plugin new ... --root <worktree>` with `<checkout>` the first line of `git worktree list`. For a job on another machine that first line is the repository `arthur remote-job repo` made there (`reach`, `repositoryThere`), which holds the project's tracked files; `arthur.config.ts` is ignored by Git, so [INFERENCE] it is not there, and the CLI answers `unknown command plugin` (exit 2), as it does from a worktree (the AR0274 test's last assertion). Not run on a real second machine.

## Goal

A job on another machine that makes a new plugin gets a line it can run there, or is told plainly that the plugin must be made on the main machine, instead of `unknown command plugin`. First check on a real second machine whether `arthur.config.ts` is missing there.

- Kind: risk

Evidence:
- `packages/develop/src/plugin-new.ts` (`pluginNewSection`), `packages/core/src/job-machine.ts:147` (`reach`), `packages/develop/docs/commands/plugin.md`
- Found by: 2026-10-22-ar0274-117ece9b (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: either the section and `plugin.md` say that a new plugin's ticket runs on the local machine (and orchestration places such a job there), or `arthur plugin new` reads its project list without the config when `ARTHUR_JOB` names a record. The local path stays as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- either the section and `plugin.md` say that a new plugin's ticket runs on the local machine (and orchestration places such a job there), or `arthur plugin new` reads its project list without the config when `ARTHUR_JOB` names a record. The local path stays as it is.

## Decisions

- 2026-10-22: Source: F1 of AR0274
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): line budget raise accepted, develop 670 to 672, for the other-machine worker section in `plugin-new.ts`.
