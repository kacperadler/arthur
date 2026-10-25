# AR0341 - Review 1

- Job: 2026-10-25-review-2658b814
- Branch: arthur/2026-10-25-worker-da17ff9b
- Commit reviewed: 1391b36073309aafc6a9baa6365b265d68ce4ad5
- Verdict: FAIL

## Final message

**Findings**

1. `packages/orchestration/src/inbox.ts:126`: no test checks that the wake's question line is redacted with the env file's values (F4's values, as the ticket requires). I swapped `redact(job.reason.slice("user: ".length), host.secrets)` for `redact(…, [])` and `job-states.test.ts` still passes, 11/11. The new test's question only holds `sk-live-4f9a8b7c6d5e4f3a2b1c`, which the vendor-prefix rule catches without `host.secrets`. The env-file value `correct-horse-battery` is only in the second line of the final message, which goes through a different `redact` call (line 132). So if someone dropped `host.secrets` on line 126, a blocked question holding an env-file value would reach the coordinator's transcript as written on the wake's first line, and no test would fail. That is the leak the ticket is about, and the review criteria count a surviving mutation of a key behavior as a FAIL. The fix is to put the env-file value in the blocked question of the new test, for example `Blocked: user the key is sk-live-… with correct-horse-battery?`.

**Notes (not blocking)**

- F1 is real. I ran `redact` on a sample line and it returned `Blocked: job [redacted]; branch arthur/[redacted] at [redacted]` for a job id, a branch and a full commit hash. Now that the wake's final-message lines go through `redact`, the coordinator sees less of a job's final message. The ticket asked for this redaction, and the worker filed it as a finding, so it does not block the merge.
- F2 (plugin wake lines that quote the final message are not redacted) is filed as an open finding, with a stated reason not to fix it here.
- On the wake's non-user path, the state line `(${job.reason})` still prints the reason as written. That is a different path from the blocked-on-owner question the ticket is about.
- The notice has a single emit point (`notify`, which the crash-recovery path also uses), and it redacts before the 4096-character cut. A secret that crosses the cut point therefore cannot slip through.
- `docs/commands/coordinator.md` is updated. The commit subject is `fix(AR0341): …`. `blocked-notice.ts` is 78 lines and `inbox.ts` 188, both under the 200-line limit.

**Checks run**

- `npm ci`: OK.
- `npm run check`: tsc clean.
- `timeout 900 npm test`: 1119 tests, 1061 pass, 0 fail, 58 skipped. The orchestration line budget held: the structure test passes.
- The `inbox.test.ts` wake and `coordinator.turn` tests did not run here either: 24 of its 30 tests skip with `NO_UNIX_SOCKET`. I read their inputs instead: the final messages are things like `line 1…20`, `Done.\nPASS` and `may I?`, which hold nothing `redact` would change. `[INFERENCE]` They should still pass.
- Mutations, each run against `job-states.test.ts` and restored with `git checkout --`; `git status` is clean afterwards:
  - Notice question not redacted at all: the new test and the crash test fail. Caught.
  - Notice `host.secrets` → `[]`: the crash test fails. Caught.
  - Wake question not redacted at all: the new test fails. Caught.
  - Wake final message not redacted at all: the new test fails. Caught.
  - Wake final message `host.secrets` → `[]`: the new test fails. Caught.
  - Wake question `host.secrets` → `[]`: 11/11 pass. **Not caught** (finding 1).
- The worker's three claimed mutations match what I saw.

FAIL