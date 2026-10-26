# AR0374 - Review 1

- Job: 2026-10-26-review-eb457a65
- Branch: arthur/2026-10-26-worker-5ba085de
- Commit reviewed: da667252a6e7f94199b6323ca0aab72f572fa0d5
- Verdict: PASS

## Final message

No findings block the merge. The branch does what AR0374 asks, as the ticket's Decisions AR-D110 and AR-D111 reshape it. Each merge step on main has a time limit, the delivery option `merge.stepSeconds` (default 3600). A step past it gets SIGKILL and is reported `failed, timed out after <n> s.`. The install's limit is now the job's timeout, and the end reason names the install. Each new behavior has a test that catches its mutation.

**Notes (not blocking)**
- **Ticket file may conflict:** `spec/features/AR0374-…/ticket.md` adds two worker lines after the second Decision. Main's copy added AR-D110 and AR-D111 at the same spot, so merging `ticket.md` will probably need a manual fix; keep all four lines.
- **No-limit edges:**
  - A job timeout of 0 still leaves an install that never returns running until `arthur stop`. This is documented in `projects.md`, and AR-D111 accepted the job timeout as the install's limit.
  - The `systemd-run … true` probe and the `systemctl --user stop` cleanup in `merge-checks.ts` still have no timeout. They don't run project code.
- **Wording edge:** at `wrapper.ts:173`, a timeout that hits after the install finished but before the agent starts, or a job with no install at all, would also say `, during its install`. The window is tiny and the result is still correct.
- **Bare mode:** without a systemd user manager, what a killed step started may keep running, as the `uncapped:` line and `merge.md` say. I checked that `spawnSync` still returns at the limit when a grandchild holds the output pipe (1007 ms with a 1 s limit), so the merge doesn't hang.
- **Very large values:** a huge `stepSeconds` (up to 1e300) passes `spawnSync`'s check and simply never fires; I probed this.
- **Option check:** `checkOptions` now walks the option table. Unknown options and keys, wrong types, 0, 1.5 and `"60"` are all refused and tested.
- **The worker's new finding F1** (a second `arthur merge` that starts during the first one's checks) matches the ticket's Description; I didn't reproduce it.
- **Worker's claims:** both of the worker's mutations reproduced. Its departures from the ticket's suggested shape are recorded under the ticket's Decisions and accepted by AR-D111.

**Checks I ran in this checkout**
- `npm ci`: added 22 packages.
- `npm run check` (tsc): clean.
- `node --test` on `merge-checks.test.ts`, `review-needed.test.ts`, `core/test/limits.test.ts` and `test/structure.test.ts`: 43 tests, all passed, exit 0.
- `node --test --test-name-pattern="stepSeconds|failed check resets" merge.test.ts`: 2 of 2 passed; the timeout test took 6.9 s.
- No systemd user manager here, so the scoped path and the check that the test's process is gone were not run.
- I did not run the full `npm test`, as the host asked; the host reports 1184 tests, 0 failed, 6 skipped.

**Mutations, each restored with `git checkout`**

| Mutation | Result |
|---|---|
| `killSignal` changed from SIGKILL to SIGTERM in `merge-checks.ts` | merge-checks test fails (`[0, null, …]`) |
| `ETIMEDOUT` match never true | merge-checks test fails |
| `delivery.ts` ignores `options.merge.stepSeconds` | merge test fails after 64 s; the step passed |
| `, during its install` suffix removed in `wrapper.ts` | install-timeout test fails |
| `playing` conditions inverted for the reason and the log line | 5 tests in `limits.test.ts` fail |
| `>= 1` changed to `>= 0` in the option check | options test fails |
| `Number.isInteger` replaced by a plain number check | options test fails |

PASS