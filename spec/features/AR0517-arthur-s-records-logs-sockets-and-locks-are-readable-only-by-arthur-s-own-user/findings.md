# AR0517 - Findings

What was discovered while doing this ticket but is not part of it. One entry per finding, numbered, never deleted: only its Status changes. These come from the non-blocking notes of the reviews.

## F1. A socket path whose folder is missing had no test

- Found by: 2026-10-27-review-70fb7bbf (review), 2026-10-27
- What: With `existsSync(folder)` removed from `coordinator.ts:142`, the suite still passed.
- Status: fixed in 0f274257

## F2. A coordinator session already running on a socket in an open folder is kept without the check

- Found by: 2026-10-27-review-70fb7bbf (review), 2026-10-27
- What: `pane()` is alive, so the folder check runs only once that coordinator ends; it touches only a server started before this change.
- Status: dropped (the next coordinator start checks it, and the default socket name needs no check)

## F3. tmux accepts a hand-made `tmux-<uid>` folder with group bits

- Found by: 2026-10-27-review-70fb7bbf (review), 2026-10-27
- What: tmux refuses only the others' bits; it makes that folder `0700` itself, so the default name is fine and the docs say "others".
- Status: dropped (information; the docs are accurate)

## F4. `umask.test.ts` and `spawn.test.ts` put their test job in the production `arthur-jobs` slice

- Found by: 2026-10-27-review-70fb7bbf (review), 2026-10-27
- What: Both run `arthur spawn` through the CLI, and `host.ts:51` hard-codes the slice; the styleguide says a test never uses a resource under a name production uses.
- Status: ticket AR0523

## F5. The umask also applies to files Arthur writes in the owner's checkouts

- Found by: 2026-10-27-review-70fb7bbf (review), 2026-10-27
- What: Board writes and merges now make owner-only files; the deployed unit already had `UMask=0077`, so the service behaves as before.
- Status: dropped (no change for the running service)

## F6. Removing `resolve` from `openFolder` is not caught by the tests

- Found by: 2026-10-27-review-909b947d (review), 2026-10-27
- What: `statSync` resolves a relative folder the same way; only the folder named in the message changes.
- Status: dropped (no behaviour depends on it)
