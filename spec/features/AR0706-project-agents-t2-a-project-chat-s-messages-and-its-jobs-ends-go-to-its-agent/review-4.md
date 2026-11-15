# AR0706 - Review 4

- Job: 2026-11-15-review-a7908b0f
- Branch: arthur/2026-11-14-worker-8a88fde0
- Commit reviewed: df2b6bdeb1bda3d458e5f5c606827a7332447775
- Verdict: PASS

## Final message

No blocking findings. The last commit, `df2b6bde`, fixes review-3's finding: a hand mutation shows the test now catches it. Check, test and mutate pass on the tip.

- **`packages/orchestration/test/project-routing.test.ts:186-200`:** the removed-agent test now gives shop a reply in `outbox/held/` that answers `inbox/turn/4-1000`. It checks that:
  - `4-1000` stays in shop's `turn/`, with `5-1000` and `7-1000`;
  - the held reply stays in `held/`;
  - only `8-1000` reaches the coordinator's queue.
- **Turn file names match what the extension writes:** the test's `answers` use names like `"4-1000"`. The real extension writes the same kind of name: `inbox-extension.ts:122` writes `answers: turn`, the turn's file names. So the start check at `inbox.ts:102-104` (`answered.has(one)` on those names) does the same thing the agent's own restart does (`inbox-extension.ts:161`).
- **Review-3's mutation is now caught:** dropping `"outbox/held"` from the list at `inbox.ts:101` makes the test fail.
- **The worker's claims match what I saw:** test counts, mutate counts and the one survivor, and only the test file changed in `df2b6bde`, so no line budget moved.

## Notes
- (minor) `packages/orchestration/src/inbox.ts:24`: mutate's only `survived:` mutant puts back `const RESULT_LINES = 15;`, which nothing reads. It changes no behaviour, so it is not a missing test. Reviews 1 to 3 said the same.

## Checks (all on `df2b6bde`)
| Command | Result |
|---|---|
| `npm run check && npm test` (one call) | `tsc`, no errors. 1865 tests: 1801 pass, 0 fail, 0 cancelled, 64 skipped (they need tmux, which this sandbox can't start). The structure test passes; its yellow files are all outside the diff. |
| `npm run mutate`, 1st call | 38 mutants, 37 caught, 1 survived; 62 not run (time) |
| `npm run mutate`, 2nd call | 78 mutants, 77 caught, 1 survived; 22 not run (time) |
| `npm run mutate`, 3rd call | 100 mutants, 99 caught, 1 survived; 361 not run (`--max 100`). The survivor is `inbox.ts:24: hunk reverted to the base`. |
| Hand mutation of `inbox.ts:101`, `["outbox", "outbox/sent", "outbox/held"]` → `["outbox", "outbox/sent"]`, then `project-routing.test.ts` | 9 pass, 1 fail: caught. Restored with `git checkout -- packages/orchestration/src/inbox.ts`; `git status --short` is empty. |

PASS