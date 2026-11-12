# AR0697 - Review 2

- Job: 2026-11-12-review-7287729e
- Branch: arthur/2026-11-12-worker-9e102476
- Commit reviewed: 50692ca94023d2e5a643fb6b42fffcb3d750a1cd
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0697 asks, from end to end. At exit, the kit's handler in `packages/core/src/testing.ts:34` sends SIGKILL to every pid except its own whose `/proc/<pid>/cwd` lies under `root/`, or whose `cmdline` contains `root`. It does this after stopping the tmux servers and the slice, and before `rmSync(root)`. The new test at `packages/core/test/testing.test.ts:349` runs a child that loads the kit and leaves two processes behind: a `sleep` working in the kit's folder, and a `node` naming a file there. The test checks that both are gone, that the child was not killed, and that two processes in sibling folders of the same TMPDIR are still running. Without the sweep the test fails, so it meets the ticket's "fails before the change". The docs (`docs/plugin-api.md:349`) and the header comment are updated. The `core/testing` line budget goes from 405 to 408 and the worker's message says why. `testing.ts` is 185 lines (green). Every claim in the worker's message that I checked matches what I ran.

## Notes
- (minor) `packages/core/test/testing.test.ts:357`: the ticket says "starts a test file", but the child is `node --input-type=module -e`, not a test file run by `node --test`. It loads the kit the same way and uses the same exit handler, so the behaviour tested is the same.
- (minor) `packages/core/src/testing.ts:34`: the cwd check compares the real path that `readlinkSync` returns with `root`, which is built from `tmpdir()`. If TMPDIR contains a symlink, no cwd matches and only the command-line check is left. This does not apply under the `/tmp` that `npm test` uses here.
- (minor) `packages/core/test/testing.test.ts:351`: the outside processes sit in `folder-*` siblings, not in another kit's `arthur-test-*` folder. When I widened the command-line match to sibling `arthur-test-` folders by hand, the test still passed. That widening is contrived (each `mkdtemp` suffix has the same length), so this is not a finding.

## Checks (on `50692ca9`)
- `npm run check && npm test`: `tsc` is clean; tests 1762, pass 1698, fail 0, cancelled 0, skipped 64.
- `npm run mutate`: 4 mutants, 4 caught, 0 survived.
- Hand mutations, each run with `node --import @arthur/core/testing --test --test-name-pattern="kills, before" packages/core/test/testing.test.ts` and restored with `git checkout -- packages/core/src/testing.ts`:
  - Sweep line removed: fails.
  - `pid !== process.pid` guard removed: fails (the child kills itself).
  - cwd check removed: fails.
  - cmdline check removed: fails.
  - cwd check widened to `dirname(root)`: fails with `actual: [ false, true ]`.
  - cmdline check widened to sibling `arthur-test-` folders: passes (the third note above).
  - Unchanged code: passes.
- `git status --short` was empty after the mutations were restored.
- `spec/features/AR0697-*/` on the branch holds only `ticket.md`: there is no `findings.md` or earlier review to compare against.

PASS