# AR0469 - Outcome

- Merged: 2026-10-27, `a4f6e90b`
- Branch: arthur/2026-10-27-worker-5893b900
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS, review-4.md PASS
- Cost: worker $4.19, reviews n/a; review rounds 4

## What went in

- `packages/delivery/src/merge-checks.ts`: after a failed check, the reinstall of main's dependencies runs with a fresh cache folder of its own (`cache-<random>` in the plugin's folder, removed in `finally`), not the cache the branch's install wrote; nothing is reinstalled when no install ran. `stepRunner` runs the probe and takes the list of the checkout's repositories once per merge, and every runner built from it, the reinstall's included, sweeps against that first list, so a `.git` that appears after the checks' last sweep is removed after the reinstall's step and named.
- `packages/delivery/src/merge-sweep.ts` (new, AR-D170, the owner): the sweep moved out of `merge-checks.ts` unchanged (`repositories`, `escapes`, `stamp`, `entries`, `remove`, and the per-step loop as `sweep`), so neither file passes 200 lines.
- `packages/delivery/src/merge-command.ts`: one `stepRunner` per merge, handed to the checks and to the reinstall.
- `packages/delivery/test/merge.test.ts`, `merge-checks.test.ts`: the reinstall's cache differs from the branch install's and both are gone after; one probe for the whole merge; a late `.git` written after the last check's sweep is removed after the reinstall's step.
- `packages/delivery/docs/commands/merge.md`: the reinstall's fresh cache, and its sweep against the merge's first look.
- `test/structure.test.ts`: delivery's line budget 1611 -> 1631 (AR-D158, AR-D162, AR-D172).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1137/1204 passed.

## Left open

- Nothing: the reviews' notes confirm claims or name recorded budgets; none is a risk.
