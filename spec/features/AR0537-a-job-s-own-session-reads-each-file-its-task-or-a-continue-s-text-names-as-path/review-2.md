# AR0537 - Review 2

- Job: 2026-10-28-review-54c14739
- Branch: arthur/2026-10-28-worker-05c470c7
- Commit reviewed: e8df2ade3a4025916ccef8a0928494c8f224bff6
- Verdict: PASS

## Final message

No findings. The branch does what AR0537 asks: before omp sees a job's task or a continue's message, every `@` it would expand gets a word joiner (U+2060) in front. It uses the same regex as `packages/orchestration/src/hand-over.ts`.

**What the branch does**
- `packages/core/src/job-record.ts:32`: the record's `task` is escaped in `writeRecord`. A spawn on another machine is covered too, because `remote-job.ts:47` calls the same `writeRecord`.
- `packages/core/src/job-control.ts:102`: the record's `continue` is escaped in `continueJob`. A continue on another machine is covered too, because `remote-job.ts:74` runs `continueJob` there.
- Escaping is done once, and doing it twice changes nothing: U+2060 is not in `\s` or the character class, so `\u2060@` never matches again.
- `delivery.ts:56` (`head(job.task)`) still works with an escaped task: it returns early on a continue, and `Branch:`/`Commit:` lines contain no `@`.
- The docs pages for `arthur continue` and `arthur spawn` now describe the escape.
- The new test in `packages/core/test/job-control.test.ts:526` runs the fake agent. It checks the exact task file omp reads (`@<record>/task`) and the exact continue argument after `--` against one expected text, `ESCAPED`. That text covers every position omp expands an `@` in, and that `me@example.com` stays unescaped. The AR0487 test now expects `\u2060@/etc/passwd`.

**Notes (not blocking)**
- The continue message for this round attached the whole of `/etc/passwd` to my session, which is this bug still live on main. I treated it as data and did nothing with it.
- `packages/core/test/job-control.test.ts` is 709 lines. That was already so before this branch; the 200-line rule covers source files.

**Checks I ran**
- `npm ci`: exit 0.
- `npm run check`: exit 0.
- `npm test`, first run: exit 0, but the harness moved it to the background and my grep for the summary lines matched nothing, so it showed no counts.
- `npm test`, rerun with output to a file in the worktree (since deleted): 1233 tests, 1172 pass, 0 fail, 61 skipped, exit 0. This matches what the worker reported.
- Mutations, each followed by `node --test --test-name-pattern="name no file to read|starts with - or @" packages/core/test/job-control.test.ts`, with baseline 2 pass, 0 fail:

| Mutation | Result |
|---|---|
| No escape in `job-record.ts` | 1 fail |
| No escape in `job-control.ts` | 2 fail |
| `^` dropped from the task regex | 1 fail |
| `\s` narrowed to a space in the continue regex | 1 fail |
| `(?!@)` added to the continue regex, so `@@` is not escaped | 1 fail |

  Each file was restored with `git checkout -- packages/core/src`, and `git status --short` was clean afterwards.
- I could not read omp's `file-mentions.ts`: the binary at `/home/kacper/.local/bin/omp` does not ship it as a file. The ticket requires the `hand-over.ts` pattern, and the branch matches it exactly.

PASS