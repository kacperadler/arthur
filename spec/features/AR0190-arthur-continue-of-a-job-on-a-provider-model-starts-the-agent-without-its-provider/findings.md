# AR0190 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A second run of commit-rules' prepare in the same worktree makes its `commit-msg` hook call itself

- Kind: risk
- Found by: 2026-10-19-ar0190-models-jobs-batch-f89d6b5b (worker), 2026-10-19
- Where: `packages/commit-rules/src/hook.ts` (`INSTALL`: `own="$(git config --type=path --get core.hooksPath || true)"`)
- What: the install reads the project's own hooks folder from `core.hooksPath` as Git reads it in the worktree; after a first install that is the worktree's own `arthur-hooks`, so a second install writes that folder into `own` and `commit-msg` then execs itself. Nothing runs a prepare twice today, but AR0190 (prepares again at `arthur continue`) would, and so would `projects`' install, which reinstalls over the agent's work. [INFERENCE: read from the lines; not run.]
- Suggestion: decide in AR0190 whether a continue calls every prepare (then the install skips an `arthur-hooks` already in place) or tells a prepare it is a continue, so only the variables are asked again.
- Status: fixed in e26c467 (option a: a prepare is told it is a continue, and commit-rules returns at once, so its install never runs twice)

## F2. The telegram outbox's retry test failed once under the full suite's load

- Kind: risk
- Found by: 2026-10-19-ar0190-core-batch-2-27eddfc2 (worker), 2026-10-19
- Where: `packages/telegram/test/telegram.test.ts:382`
- What: in the full `npm test` after merging origin/main, "one retry per send, after 2 s; a slice failing twice waits with the ones after it and goes first next time, said once" failed after 24 s (733 of 734 passed); run alone right after, it passed in 6.5 s. The merge changed only telegram's `module` line in that package, so it is a timing-dependent test, not this batch's behaviour [INFERENCE: the failure's assertion was not captured].
- Suggestion: run it under load (the full suite, or several at once) to see which wait it misses, and make it wait for the state it asserts rather than a time; out: the outbox's behaviour.
- Status: dropped (did not reproduce: review 2 of AR0213 ran the full suite twice, 734/734, and the file 10 times under taskset -c 0,1, 10/10; a new failure gets its own ticket)
