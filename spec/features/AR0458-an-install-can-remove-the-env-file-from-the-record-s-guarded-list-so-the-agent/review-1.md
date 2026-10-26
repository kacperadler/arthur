# AR0458 - Review 1

- Job: 2026-10-26-review-f5263cdd
- Branch: arthur/2026-10-26-worker-5e33d5b1
- Commit reviewed: 5593a02e015b733185b1b273112e9eb459039268
- Verdict: PASS

## Final message

I found no blocking findings. The branch does what the ticket's Done means asks: the env file stays hidden from the install and from the agent, whatever the install writes to the job's record.

**Done means, point by point**
- **Hidden list read once:** `packages/core/src/wrapper.ts:122` reads `hidden(folder)` into `secrets` before the install. The install's sandbox (`:123`) and the agent's sandbox (`:129`) both get that one list. `secrets` is never read again, so it is the same on every agent run, including after a `continue`. The other record fields the agent's sandbox uses (`extensions` at `:74`) are also read before the install. So nothing the install writes to the record can change what the agent hides.
- **The test:** `packages/core/test/sandbox.test.ts:377` makes the install empty every `jobs/*/guarded` file, then checks three things: `guarded` really is empty, the agent's `cat` of the env file gets `Permission denied`, and no file in the record holds `s3cret-t0ken`. It is marked `skip: bare` like the other Landlock tests.
- **File size:** the worker kept `wrapper.ts` at 200 lines by moving the old install comment onto the end of the `secrets` line, and gave that reason in its final message. No line budget had to be raised.
- **Scope:** only the two files the ticket names changed, in one commit, `fix(AR0458): …`.

**Notes (not blocking)**
- The new comment at `wrapper.ts:122` is a long trailing comment instead of the usual one line above the code. That is a wording choice, done to stay within the 200-line limit.
- Outside the range: the worktree guard still reads the record's `guarded` file again on each tool call (`job-place.ts:64`). An install that empties it removes the guard's write refusals, but Landlock still limits the writes. The ticket only asks for the env file to stay hidden.

**Checks I ran (in this worktree, in the foreground)**
- `npm run check` (tsc): no errors.
- `node --test packages/core/test/sandbox.test.ts`: 16 tests, 12 pass, 0 fail, 4 skipped, matching the worker's report. The new test ran and passed.
- `wc -l packages/core/src/wrapper.ts`: 200 lines.
- **Mutation 1**, the agent's sandbox reads `hidden(folder)` again after the install: the new test fails, and the agent read `'ARTHUR_SECRET_TOKEN=s3cret-t0ken\n'`. This matches the worker's "fails before the fix" claim.
- **Mutation 2**, `secrets` set to `[]`: the new test fails, and so do the two existing env-file tests, on three runs in a row. My first try of this mutation reported a pass, but I had run it at the same time as mutation 1 in the same worktree, so that result is invalid.
- Both mutations were restored with `git checkout -- packages/core/src/wrapper.ts`, and `git status` is clean.
- I did not run the full `npm test`, as you asked. Your host run on 5593a02e (1179 tests, 0 fail, the new Landlock test included) covers it.

PASS