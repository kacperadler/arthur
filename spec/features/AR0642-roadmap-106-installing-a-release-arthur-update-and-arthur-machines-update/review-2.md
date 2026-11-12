# AR0642 - Review 2

- Job: 2026-11-12-review-dadc5e13
- Branch: arthur/2026-11-12-worker-967c43d8
- Commit reviewed: f3fce548961f7bdd868e0123877fad4a7e97ed57
- Verdict: PASS

## Final message

No blocking findings. The five survivors from review 1 are gone, and the branch meets every Delivers and Done means point of roadmap entry 106.

- **Review 1, findings 1–4:** each now has a test that would catch its mutant.
  - The fake `dirty-box` machine writes npm error lines before its own last stderr line.
  - A fake `git` whose `fetch` exits 128 without printing anything gives `git fetch in <root>: exit code 128`.
  - Naming `mac` with an empty machine list gives `no machine mac; machines: none`.
  - `empty-box`, whose `arthur version` prints an empty line, gives `it runs arthur (no version)`.

  All 100 mutants run were caught (below).
- **Review 1, finding 5:** `--no-replace-objects` is gone from `packages/machines/src/machine-update.ts:26`.
- **Review 1 notes:**
  - A run that is cut now has its own line (`machine-update.ts:36`), and the `cut-box` test covers it.
  - A machine that fails without printing anything is tested (`silent: not updated: exit code 3`).
  - The restart line now begins `under its service, …`, and `update.md` says an `arthur run` started by hand is restarted by hand.
- **Delivers and Done means:**
  - `docs/setup.md` step 4 has the exact checkout line.
  - `arthur update` is registered without `inJob`. It refuses a core outside Git, changed tracked files (each named, staged changes too) and, with no argument, a checkout on a branch.
  - When `npm ci` fails, it goes back (to the branch too), runs `npm ci` again and says so.
  - The restart guard or `systemctl` restart line is printed. `machines update` targets the HEAD here, and an offline machine (ssh exit 255) is named and skipped. The doctor fix texts name `arthur machines update <name>`.
  - Help pages are updated.
- **Boundaries:** machines imports only `@arthur/core/inside-job` and `@arthur/core/plugin`. The in-job refusal uses `insideJob(dirname(host.folder))`, as `github-ci.ts` and `schedule-command.ts` do. The refusal is checked before the list and before any SSH. `/machines update` on a channel gets the usage line.
- **Budgets:** core 7532 → 7607 and machines 538 → 583. The final message names both raises as the owner's decision, as the ticket requires. No changed source file is yellow or red: `update.ts` is 71 lines and `machine-update.ts` is 40.
- **Doc search:** I searched for `update Arthur there`, `at this commit`, `at the same commit`, `npm i -g arthur`, `git pull` and `npm ci` in the docs and README. The remaining hits are the new text, unrelated uses (`auditor.md`, `test/release.ts`), or a dropped ticket's title in `spec/build.json`.

## Notes
- (minor) `packages/machines/src/machine-update.ts:31`: `arthur machines update` detaches a machine whose checkout is on a branch, because `arthur update <commit>` there moves it to the commit, detached. A later `git pull` there then fails. `machines.md` covers this only indirectly ("a development checkout of `main` included").
- (minor) `docs/setup.md:54`: on an existing clone, the `git checkout` line moves to the newest tag that clone already holds, without fetching. The prose says so, but a reader re-running step 4 to update gets no new release.

No `findings.md` on the branch, so no overlap.

## Checks (all on f3fce548)
- `npm run mutate`, rerun until nothing was left unrun for time:
  - 1st: 22 caught, 0 survived, 78 not run (time).
  - 2nd: 37 caught, 0 survived, 63 not run (time).
  - 3rd: 100 mutants, 100 caught, 0 survived; 140 not run (`--max 100`).
- `npm run check`: tsc passed.
- `npm test`: 1796 tests, 1732 pass, 0 fail, 64 skipped, exit 0. The structure test passed and lists no file from this diff as yellow.
- `node packages/core/src/cli.ts update --help` in a temporary folder prints `update.md`.
- `node packages/core/src/cli.ts update a b` in the same folder printed `arthur update: refused inside a job 2026-11-12-review-dadc5e13: …`, exit 1. This review runs in a job, so this shows the in-job refusal comes before the usage check. The usage line itself is covered by `update.test.ts`.
- I did not run `arthur update` itself: it would have moved this review's checkout. Its behaviour is covered by `update.test.ts`, against real Git and real `npm ci`.
- `git status --short` afterwards: clean.

PASS