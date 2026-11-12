# AR0642 - Review 1

- Job: 2026-11-12-review-95922590
- Branch: arthur/2026-11-12-worker-967c43d8
- Commit reviewed: 5a96048fd1026761c02932471a3903f8fb53f70e
- Verdict: FAIL

## Final message

## Findings

1. **`packages/machines/src/machine-update.ts:14` — mutant survived: `lastLine` uses `.at(-0)` instead of `.at(-1)`.** This is a key behavior. Line 32 builds the `not updated: <its last line>` message from it, as `packages/machines/docs/commands/machines.md`, "Updating", promises. A real `arthur update` that fails on a machine writes `npm ci`'s errors to stderr (`npmCi` passes stderr through, `update.ts:22`). Only after them comes its own `arthur update: npm ci failed at … ; back at …, npm ci ran again there` line. With the mutant, the owner sees npm's first error line and never learns whether that machine rolled back or is broken. Every fake machine in `machines.test.ts` writes exactly one stderr line, so nothing catches it. The worker reported this survivor and left it without a test.
2. **`packages/core/src/update.ts:13` — mutant survived: dropping `|| \`exit code ${run.status}\`` in `said`.** No test has a git step that fails with empty stderr. A refusal would then end in `git fetch in <checkout>: ` with no reason after it.
3. **`packages/machines/src/machine-update.ts:24` — mutant survived: dropping `|| "none"`.** No test names a machine while the list is empty, so `no machine <name>; machines: none` is never checked.
4. **`packages/machines/src/machine-check.ts:88` — mutant survived: dropping `theirs || "(no version)"`.** This branch rewrote that line's fix text, and no test has a machine whose `arthur version` prints an empty line.
5. **`packages/machines/src/machine-update.ts:26` — mutant survived: removing `--no-replace-objects` from `git rev-parse --verify HEAD`.** I confirm the worker's view: `rev-parse HEAD` returns the ref's object id whether or not a replacement exists, so this mutant changes nothing. The flag does nothing there and is code beyond what the change needs; deleting it removes the survivor.

Under verify.md, each `survived:` line is a missing test. Finding 1 alone fails the review, because a key behavior's mutation goes uncaught.

## Notes
- (risk) `packages/machines/src/machine-update.ts:12`: the 600 s cut can land during `npm ci` on a machine. That kills the remote `arthur update` before its rollback, which can leave the machine on the new commit with half-installed `node_modules`. The output then says only `not updated: <npm's last line>` or `exit code null`, never that the machine may be half-updated.
- (minor) `packages/machines/src/machine-update.ts:33`: no test covers a run cut by time (`code === null`). The test only checks that 600 is passed, though the doc lists `cut` among the `not updated` outcomes.
- (minor) `packages/core/src/update.ts:52`: the restart-guard line says `arthur run restarts on it` whenever the session plugin is enabled. Per `docs/deploy.md`, that plugin restarts `arthur run` itself only under the service.

Nothing in `findings.md` overlaps these: the branch has none. No stale doc text was found: I searched for `update Arthur there`, `at this commit`, `at the same commit`, `npm i -g arthur` and `` usage: arthur machines` ``. The worker's claims match what I saw: the test counts, the 5 survivors, budgets core 7607 and machines 579, and the commits.

## Checks (all on 5a96048f)
- `npm run mutate`, run 3 times to resume after the time cuts:
  - 1st: 22 run, 22 caught, 78 not run (time).
  - 2nd: 37 run, 36 caught, 1 survived, 63 not run (time).
  - 3rd: 100 run, 95 caught, 5 survived (the 5 above); 138 not run (`--max 100`).
- `npm run check`: tsc exited 0.
- `npm test`: 1796 tests, 1732 pass, 0 fail, 64 skipped.
- `git status --short` afterwards: clean.

FAIL