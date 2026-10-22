# AR0271 - Review 2

- Job: 2026-10-22-review-ar0271-24d85909
- Branch: h/2026-10-22-ar0271-72a7b9ab
- Commit reviewed: e927995b7c4a60890eb997b020286fa984dea2a8
- Verdict: PASS

## Final message

The new test fixes the earlier finding. I found no new problems in the work since `cd6a8f45`.

**Findings:** none. The new work is one test in `packages/resources/test/disk.test.ts` and a `findings.md` for the ticket. The source file `machine-free.ts` is unchanged since `cd6a8f4`.

**Mutation:** I moved `writeFileSync` and `renameSync` outside the `withLock` callback and left `readSample` inside. This is the mutation the earlier review reported as uncaught. It is now caught: 8 pass, 1 fail, and the failing test is the new "a check writes its own under the lock it read the one before under…". I restored the file afterwards.

**How the test works:** The check's temporary file `gpu.json.<pid>` is a FIFO, and the failure reason is 256 KiB. The write therefore blocks until a child process reads the pipe. The child first reads `gpu.json.lock` and reports the holder's pid. The test asserts three things:
- The lock named this process while it wrote.
- The bytes written equal the check that was kept.
- The lock file is gone afterwards.

It needs no timing or polling.

**Notes:**
- If the child died before opening the FIFO, the blocking write would hang the test file instead of failing it. The worker named this limit itself.
- `findings.md` F1 (a tmux server left running by an orchestration test) is `open` and is turned into a planning ticket at merge.
- I did not mutate-test `findings.md`'s F1 claim. During my own full run I saw a tmux `coord` socket and a fake agent. They belonged to another review's worktree (ar0279) that was running at the same time, not to this branch.

**Checks:**
- `npm ci`: exit 0.
- `npm run check`: tsc, no errors.
- `node --test packages/resources/test/disk.test.ts`: 9 pass, 0 fail.
- `npm test`: 1018 tests, 1018 pass, 0 fail.
- `git status --short` is clean after the mutation was restored.

PASS
