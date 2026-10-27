# AR0516 - Findings

What was discovered while doing this ticket but is not part of it. One entry per finding, numbered, never deleted: only its Status changes. These come from the non-blocking notes of `review-1.md`.

## F1. `cached` and `unsigned` are written as single long lines to stay within the core's line budget

- Found by: 2026-10-27-review-365f8876 (review), 2026-10-27
- What: `packages/core/src/job-sandbox.ts:106`, `:108`: each about 400 characters on one line; about 2 lines over the budget that the budget test does not see.
- Status: dropped (a style cost of about 2 lines, stated openly by the worker; the core budget can be raised by policy AR-D63 when the file is next touched)

## F2. `unsigned` gains an unused optional second parameter

- Found by: 2026-10-27-review-365f8876 (review), 2026-10-27
- What: `unsigned(env, given = ...)` uses a default parameter as a local variable.
- Status: dropped (taste; no caller is affected)

## F3. A malformed inherited `GIT_CONFIG_COUNT` is replaced by 2

- Found by: 2026-10-27-review-365f8876 (review), 2026-10-27
- What: A value Git would reject (`abc`) is silently replaced.
- Status: dropped (Git refuses that environment anyway; not a regression)

## F4. `tag.forceSignAnnotated` was tested only with `git tag -a`

- Found by: 2026-10-27-review-365f8876 (review), 2026-10-27
- What: The reviewer checked `git tag t -m x` with `forceSignAnnotated=true`: exit 0, an unsigned tag, a stray `Couldn't load public key` line.
- Status: dropped (nothing breaks; the case the test skipped also passes)

## F5. Not yet seen in a real job

- Found by: 2026-10-27-review-365f8876 (review), 2026-10-27
- What: Tests passing inside a job and a merge step were shown only with the variables set by hand.
- Status: dropped (the first job after the restart that loads this merge shows it; the coordinator checks that job's commits)

## F6. The commit is scoped `fix(core)`, not by the ticket id

- Found by: 2026-10-27-review-365f8876 (review), 2026-10-27
- What: The worker names the commit hook's regex as the reason.
- Status: dropped (the hook's rule allows it)

## F7. The env guard refuses a command whose text holds the word env after a dot

- Found by: 2026-10-27-review-365f8876 (review), 2026-10-27
- What: A bash `sed` whose pattern held Node's environment object (a dot, then `env`) was refused as if it named the secrets file; the reviewer and the coordinator both hit it on 2026-10-27.
- Status: ticket AR0519
