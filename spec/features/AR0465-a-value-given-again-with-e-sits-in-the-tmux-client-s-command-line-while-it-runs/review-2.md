# AR0465 - Review 2

- Job: 2026-10-27-review-5adbb985
- Branch: arthur/2026-10-27-worker-1209ec59
- Commit reviewed: 2801c6db4c14e70f36c69bbd459d036b3c77ff79
- Verdict: PASS

## Final message

No blocking findings. The review-1 finding is fixed and the branch meets the ticket's "Done means".

**What the branch does**
- **Fix (`packages/orchestration/src/coordinator.ts:118-122, 138-153`):** when a tmux server is already running and holds a different value for a name, `own()` now gives tmux only that name. It sets it in `update-environment` at free indices (highest index + 1), so `new-session` copies `arthur run`'s value from the tmux client's environment instead of from a `-e NAME=value` argument. `restore` runs right after `made` on every path, and the calls between `own()` and `restore` all run synchronously. The `ARTHUR_*` variables still go through `-e`, as the ticket's "Out" allows.
- **Review-1 finding (`packages/orchestration/test/coordinator.test.ts:127-156`):** the `tmux` wrapper on `PATH` now refuses the first `new-session … -s coord`. It writes a marker file, exits 1 and never runs the real tmux. The test then:
  - waits for the exact `coordinator start failed: tmux new-session: refused once by the test` line;
  - checks that no agent has started yet;
  - compares `show-options -g update-environment` with its value from before the start.
- **The new check is not racy:** the test's own `tmux` calls are `spawnSync` in the same Node process, so they cannot land between the retry's `own()` and its `restore`.
- **Which mutations it catches:**
  - Restoring only when `made.status === 0` leaves the index set after the refused start. You report this mutation failing on the host.
  - Dropping the `set-option` call leaves the agent with `stale`.
  - Going back to `-e NAME=value` puts the value in the logged argv.
  - Dropping `restore` breaks both `update-environment` checks.

**Notes (not blocking)**
- The race from review-1 still stands: if the server exits between `show-environment` and `show-options`, `free` becomes 0. That only matters when no server is left to hold the option. The worker's reasoning about it was not tested.
- The test's own `tmux new-session -s other` also goes through the wrapper. It does not match `-s coord`, so it is only logged.
- The doc lines in `packages/orchestration/docs/commands/coordinator.md` match the code, including the `tmux set-environment, set-option:` failure line. `coordinator.ts` is 153 lines. The 2421 budget is recorded in AR-D165.

**Checks I ran**
- `npm ci`: 22 packages added.
- `npm run check`: exit 0.
- `node --test packages/orchestration/test/coordinator.test.ts test/structure.test.ts`: 31 tests, 18 pass, 0 fail, 13 skipped. All 13 skipped are tmux tests, because this sandbox refuses Unix sockets: `tmux -S <tmp>/s new-session` gives "Permission denied" with tmux 3.4.
- I had started `npm test` before your message. I stopped it (killed its process group), so it gives no result. The failures it printed came from that kill.
- **Not run by me:** tmux tests and mutation runs. The coordinator file passing 15 of 15 and the review-1 mutation being caught come from your host run.

PASS