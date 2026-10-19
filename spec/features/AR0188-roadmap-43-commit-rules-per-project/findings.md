# AR0188 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A plugin's prompt section cannot add to the spawn's warnings

- Kind: improvement
- Found by: 2026-10-19-ar0188-commit-rules-3a76b3d2 (worker), 2026-10-19
- Where: `packages/core/src/roles.ts:125` (`prompt`), `packages/commit-rules/src/commit-rules.ts:45`
- What: a provider of `prompt` returns text or undefined only, so commit-rules says a missing or empty rule file with `console.error("warning: ...")`. In `arthur spawn` that reaches stderr beside the core's own `warning:` lines, but a spawn through `host.jobs.spawn` (a schedule entry in `arthur run`, later delivery) gets it only in the run's log, not in the job's `warnings` as a missing criteria file is.
- Suggestion: let a `prompt` provider return `{ text, warnings }` and join those warnings to `Started.warnings`; commit-rules then returns its warning instead of printing it. Out: any change to how `arthur spawn` prints warnings.
- Status: open

## F2. The option-tables test cannot list a plugin without options

- Kind: cleanup
- Found by: 2026-10-19-ar0188-commit-rules-3a76b3d2 (worker), 2026-10-19
- Where: `test/option-tables.test.ts:54` and `:114`
- What: the test asserts every listed plugin has at least one option, and that its unknown-option refusal ends with its option names, so commit-rules (only `enabled`, an empty table) is left out of `PLUGINS`; its summary and table are checked by its own test only.
- Suggestion: allow an empty table there (assert the summary and tools as for the others) and list commit-rules.
- Status: open

## F3. The example's Conventional Commits regex allows subjects over 72 characters

- Kind: improvement
- Found by: 2026-10-19-ar0188-commit-rules-3a76b3d2 (worker), 2026-10-19
- Where: `arthur.config.example.ts:235`
- What: `^(feat|...)(\([\w-]+\))?!?: .{1,72}$` counts 72 after the `type(scope): ` prefix, so a subject of up to about 90 characters passes, while the worker role of this repository says a subject is at most 72. Of the last 200 non-merge subjects on this branch all match it and 5 are over 72 (`git log --format=%s -200 --no-merges`).
- Suggestion: `^(?=.{1,72}$)(feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(\([\w-]+\))?!?: .+$`, if the owner wants the 72 to be the whole subject.
- Status: open

## F4. The hook broke every worktree of a bare repository, as on another machine

- Kind: bug
- Found by: review 1 of AR0188, 2026-10-19
- Where: `packages/commit-rules/src/hook.ts` (`INSTALL`), `packages/core/src/remote-job.ts:32`
- What: turning on `extensions.worktreeConfig` makes a `core.bare = true` (or a `core.worktree`) in the shared config hold for every linked worktree, so in `<home>/repos/<project>.git` on another machine every `git status`, `add` and `commit` in a job's worktree failed with `fatal: this operation must be run in a work tree`. `arthur remote-job repo` also ran `git init --bare` on every spawn, which writes `core.bare` back into the shared config.
- Suggestion: move both keys into the main one's `config.worktree` before turning the extension on, as `git sparse-checkout init` does, and create the remote repository only once.
- Status: fixed in 9d93a9e

## F5. wrapper.test.ts failed once on a cleanup race

- Kind: bug
- Found by: review 1 of AR0188, 2026-10-19
- Where: `packages/core/test/wrapper.test.ts:206`
- What: one full `npm test` run of the review failed there with `ENOTEMPTY` from `rmSync`, with no change under `packages/core/test/wrapper.test.ts` or the wrapper on this branch; not reproduced by the worker.
- Suggestion: find what still writes into the folder when the test removes it, and wait for that state before `rmSync`.
- Status: open
