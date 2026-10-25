# AR0401 - Review 1

- Job: 2026-10-25-review-1120464b
- Branch: arthur/2026-10-25-worker-3ca726ff
- Commit reviewed: b6b562a2e000f0b1fabb8de357c9d4c8130a9c97
- Verdict: FAIL

## Final message

**Findings**

1. `packages/orchestration/test/inbox.test.ts:720` and `:739` skip tests that never start a tmux server. These are "a restart after a claim's reply went out and before its message was queued…" and "a message left in received/ from before a log cut by hand…". Both build their fixture with `restarts()` (`inbox.test.ts:703`). That function runs `inbox(fake.host)` alone on a fake host, with no coordinator, no `supervise`, no tmux socket. I made `NO_UNIX_SOCKET` always `false` and ran these two in this sandbox, where Unix sockets are refused (EACCES): **both pass**. So the branch skips tests that can run here, which the task says must not happen. A sandboxed worker loses that inbox restart and claim coverage for no reason. The final message also says the `{ skip }` went "on each test that starts a tmux server", which is wrong for these two. The fix is to remove `{ skip: NO_UNIX_SOCKET }` from those two tests, leaving 24 of 29 skipped in `inbox.test.ts`.

**Notes**
- With `NO_UNIX_SOCKET` set to `false`, every other skipped test does need tmux:
  - all 12 skipped in `coordinator.test.ts` fail, each after about 15 s;
  - the 1 in `silent.test.ts` fails;
  - in `inbox.test.ts`, "a message's parts are one turn…" and "owner messages received before the start…" fail. Every other skipped inbox test calls `box.start()`, which starts the coordinator in tmux.
  - With the core skip removed, the kit test in `packages/core/test/testing.test.ts` fails here with `error connecting to …/tmux.sock (Permission denied)`.
- The tests left running are the right ones: in `coordinator.test.ts`, "attach with no session" and the doctor test; in `inbox.test.ts`, `pause`, "one event queued twice" and "a malformed message-received…". All pass inside the sandbox.
- Every skip states its reason: `this host refuses a Unix socket (EACCES), so tmux cannot start a server`.
- The probe in `packages/core/test/testing.test.ts:245-249` repeats `unix-socket.ts`. The core can't import from a plugin, so the copy is justified.
- F1 (`/proc/self/oom_score_adj`) is out of scope, as the task says; the worker logged it in `findings.md`.

**Checks run** (in my own checkout, at HEAD b6b562a2)
- `timeout 300 npm run check`: tsc, no errors.
- `silent.test.ts`: 8 tests, 7 pass, 0 fail, 1 skipped with the reason.
- `coordinator.test.ts`: 14 tests, 2 pass, 0 fail, 12 skipped.
- `inbox.test.ts`: 29 tests, 3 pass, 0 fail, 26 skipped.
- `packages/core/test/testing.test.ts`: 16 tests, 14 pass, 0 fail, 2 skipped (Unix socket; no systemd user manager).
- Mutation, probe forced to `false`, silent and coordinator files together: 22 tests, 9 pass, 13 fail. All 13 are the skipped tmux tests.
- Mutation, probe forced to `false`, four late inbox tests by name: 2 fail (they need tmux), 2 pass. The 2 that pass are finding 1.
- Mutation, `|| NO_UNIX_SOCKET` removed from the core kit test: 1 fail with Permission denied.
- The worker's numbers match what I see, except the claim that every skipped test starts a tmux server.

I reverted every mutation with `git checkout --`, and `git status` is clean.

FAIL