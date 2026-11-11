# AR0691 - Review 1

- Job: 2026-11-11-review-92a4b55f
- Branch: arthur/2026-11-11-worker-32ad867e
- Commit reviewed: c2107e993c028b5e7693b92e00cf3df905a49421
- Verdict: FAIL

## Final message

I'm failing this branch. A merge-specific check that the ticket requires can be removed without any test failing. The rest of the work is sound: checks pass, the worker's claims reproduce, and five other hand mutations of the key holds were caught.

## Findings

1. **`packages/session/src/restart.ts:197`: the fresh start's own hold for a running merge has no test that catches its removal.** I changed `const held = busy(host, false);` to `const held = host.jobs.running().length > 0 ? busy(host, false) : "";`, so the try ignores merges. The full session suite still passed: 72 tests, 72 pass, 0 fail.
   - **Why it survives:** the new test "a merge delivery names holds the fresh start as a job does: a try while it runs asks nothing…" (`packages/session/test/restart.test.ts:229`) runs with no coordinator. Under the mutation the try does write the fresh request. Then `settle()` reaches the shared `busy(host, !byNight)` check, removes the request and calls `again(...)`. So `box.request()` is `undefined` again and `box.out` is empty by the time the test asserts.
   - **What a user would see:** with a coordinator up, the mutant asks the coordinator for its handoff at every try while a merge runs. `docs/session.md` step 2 says such a try "waits for the next try, without a line", and step 3 asks for the handoff only "with no job and no merge running".
   - **Why it fails the branch:** this is the Done-means point "the fresh start's try … treat it as they treat a running job". The job version of this test, "while a job runs a try asks the coordinator for nothing" (`restart.test.ts:159`), uses a coordinator and checks that it got no message. The merge version needs the same: a coordinator up, and `first.messages()` empty after the 23:00 try.

## Notes
- (risk) `packages/session/docs/session.md:5`, `packages/session/docs/commands/restart.md:7`, `docs/plugin-api.md:138`: the docs claim more than F1 allows. They say a merge holds the restart "from the merge's first look at main to its end" and that "a restart never ends a merge on main". F1 shows the hold ends before `github.push` and `pruneTicket`. This adds to F1: these lines need to change with its fix, or be narrowed now.
- (minor) `packages/delivery/src/merge-recovery.ts:62`: `merging()` takes the pid from `merge.lock` and ignores the boot id, which core's `holder()` checks. After a reboot, a lock from the earlier boot whose pid now belongs to a live process counts as a running merge. It stops counting once `passForward.start`'s `rerun` → `recoverMerge` takes the lock over.
- (minor) `packages/session/test/`: one session test run left a process behind. The fake agent `fake-agent.ts … -e …/handoff-extension.ts` (pid 1109595) was still running about 50 minutes after it started, under a temp folder `/tmp/arthur-test-Y4i1vJ`. I stopped it. I did not find which test started it.

## Checks (all on c2107e99)
- **`npm run check`:** tsc, no errors.
- **`npm test`:** 1743 tests, 1679 pass, 0 fail, 64 skipped. `packages/session/src/restart.ts` is at 216 lines, yellow; the worker said so.
- **`npm run mutate -- --max 25`, first run:** 17 mutants, 12 caught, 5 survived, 8 not run (time).
- **Second run, resumed:** 25 mutants, 18 caught, 7 survived, 78 not run (`--max 25`). The 7 survivors are the same ones the worker listed: 5 in `arthur.config.example.ts:220`, 1 in `session-options.ts:34`, 1 in `restart.ts:87`, all wording or example values.
- **Hand mutations.** Each file was restored with `git checkout -- <file>` afterwards; `git status` is clean.
  - Removed `&& busy(host, false) === ""` from the restart-due tick: caught, 3 tests in `restart.test.ts` fail, the new merge one included.
  - Changed settle's `busy(host, !byNight)` so it only holds while a job runs: caught by the new `/restart` merge test.
  - Replaced `alive(pid)` with `true` in `merging()`: caught by the `delivery.merging` test in `merge.test.ts`.
  - Removed the own-pid `holds(...)` branch from `merging()`: caught by the same test (the `${process.pid}` lock case).
  - Made the fresh start's try at `restart.ts:197` ignore merges: **survived** the whole session suite (Finding 1).

FAIL