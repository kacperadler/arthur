# AR0428 - Review 1

- Job: 2026-10-25-review-027a571c
- Branch: arthur/2026-10-25-worker-de062520
- Commit reviewed: bb0306a7eb8eb44bc8ee3a007b17acaa262d1e13
- Verdict: PASS

## Final message

The branch is mergeable: there are no blocking findings. Both paths to the phone now redact an env-file secret in one pass with `host.secrets`, so `pass-word-sk-live-4f9a8b7c` comes out as `[redacted]` with no part left. On main the same value came out as `pass-word-[redacted]`.

## Findings
None.

## Notes (non-blocking)
- **Change matches the ticket.** It takes the ticket's first option: the extensions leave the raw text.
  - `packages/orchestration/src/inbox-extension.ts:116` writes `last?.errorMessage` as it is, and only `inbox.ts:185` `sweep` redacts it, with `redact(file.notice, host.secrets)`.
  - `packages/session/src/turn-extension.ts:43` writes the raw error, and only `start-notice.ts` `line()` redacts it, with `host.secrets`.
  - In `credential.ts`, the env-file values are replaced before the shape rules run, so a Telegram `<bot id>:` part is matched whole too. I did not test that case.
- **Raw copies (Done-means item 2):** the final message names both folders and gives the reasons for keeping the text raw:
  - `turn-failed/` is deleted by `rmSync` in `start-notice.ts:94` on the next sweep.
  - `outbox/sent/` keeps the raw notice for up to 7 days.
  - Both folders are in the 0700 home folder.
  - It is an accepted tradeoff and both docs say it.
- **F1 is real and correctly left open in `findings.md`.** The rule that redacts a variable by its name (KEY, TOKEN, …) now reads `arthur run`'s `process.env` instead of omp's. omp starts through `tmux new-session` (`coordinator.ts:116`), so it gets the tmux server's global environment. This only matters if that environment differs from `arthur run`'s; the shape rules still apply either way.
- **Test replaced, not lost.** The old plugin-only inbox test, which wrote a hand-made outbox file, is gone. The new one drives the real extension through a fake `pi` and then runs the plugin's sweep, which is stronger and needs no Unix socket.
- **One test was not exercised here.** Unix sockets are refused on this host (`listen` gave EACCES), so the updated tmux test "…nor any part of an env file value" was skipped for me, as it was for the worker. The extension → sweep path it covers is also covered by the new socket-free test.

## Checks
- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1121 tests, 1063 pass, 0 fail, 58 skipped (socket/tmux).
- Every mutation below failed the named test. Each was restored with `git checkout --`, and `git status` was clean at the end.

| Mutation | Test that failed | What it got |
|---|---|---|
| Put `redact(…, [])` back in `inbox-extension.ts` | new inbox extension test | `401 password pass-word-[redacted]` |
| `sweep` redacts with `[]` instead of `host.secrets` | new inbox extension test | `pass-word-[redacted]` |
| `sweep` emits `file.notice` unredacted | new inbox extension test | full value leaked |
| Put `redact(…, [])` back in `turn-extension.ts` | both start-notice tests | `529 overloaded; key [redacted]` for the file, and `500 internal; password pass-word-[redacted]` for the notice |
| `line(reason, [])` in `start-notice.ts` | the `arthur run` turn-failure test | `password pass-word-[redacted]` |

PASS