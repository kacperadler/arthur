# AR0401 - Review 2

- Job: 2026-10-25-review-f406ba8e
- Branch: arthur/2026-10-25-worker-3ca726ff
- Commit reviewed: 05333a7fa7581f65012c9b252568ab93bf83179c
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The previous review's one finding is fixed: the two inbox restart tests at `packages/orchestration/test/inbox.test.ts:720` and `:739` are no longer skipped. Both build their fixture with `restarts()` (`inbox.test.ts:703`), which runs `inbox(fake.host)` on its own and starts no tmux server, and both pass here, where the sandbox refuses Unix sockets.

**Findings**

None.

**Notes**

- **`npm test` still fails inside this sandbox, but not because of this branch.** About 40 tests fail. The suite's last output lines name 40 failing tests across the orchestration, delivery, models, nvm and session packages and the root `test/`. Each one starts a real job and hits its timeout (15–21 s), such as "timed out waiting for both in their run". In this sandbox, writing `/proc/self/oom_score_adj` gives `EACCES`, which is the open finding F1 in `findings.md`. The branch only adds skip options and the probe; it changes no `src/` file and no test that spawns a job. None of the failing tests are in the files the range changes. F1 is outside this ticket's scope and is logged as `Status: open`. Because of it, the ticket's Goal ("every test passing" inside the sandbox) is only fully met once F1 is fixed. I could not run `npm test` outside the sandbox, where `arthur merge` runs it.
- **A probe that always skipped would not be caught.** If `NO_UNIX_SOCKET` were always set to a string, the 39 tests would skip silently on a host that does allow sockets, and no test would fail. Every skip-on-probe works this way, including the root skip in `doctor.test.ts` that the ticket names as the model.
- **The probe is written twice.** It appears in `packages/core/test/testing.test.ts:245-249` and in `packages/orchestration/test/unix-socket.ts`. The core cannot import from a plugin, so the copy is justified.
- **The worker's counts match what I see.** Skipped: coordinator 12 of 14, inbox 24 of 29, silent 1 of 8, and in `testing.test.ts` one test for the Unix socket (plus one for the missing systemd user manager). Every skip prints `this host refuses a Unix socket (EACCES), so tmux cannot start a server`.

**Checks run** (in my own checkout, at 05333a7f)

- **Sandbox socket probe:** a Unix-socket listen got `EACCES`, so this host has the sandbox the ticket describes.
- **`npm ci`:** installed 22 packages.
- **`npm run check`:** tsc reported no errors.
- **The four affected test files:** `inbox.test.ts`, `silent.test.ts`, `coordinator.test.ts` and `packages/core/test/testing.test.ts` together gave 67 tests: 28 pass, 0 fail, 39 skipped.
- **`npm test`:** took 684 s and about 40 tests failed. All of them start a real job and time out, and none are in the changed files. I re-ran "a spawn while maxAgents jobs are in a run is refused" (`spawn-rules.test.ts`) alone and it fails the same way: `timed out waiting for both in their run`. A direct write to `/proc/self/oom_score_adj` gives `EACCES`.
- **Mutation:** with `NO_UNIX_SOCKET` forced to `false` in `unix-socket.ts`, `silent.test.ts` ran 8 tests: 7 pass, 1 fail (the tmux test), 0 skipped. I restored the file with `git checkout --`, and `git status` is clean.

PASS