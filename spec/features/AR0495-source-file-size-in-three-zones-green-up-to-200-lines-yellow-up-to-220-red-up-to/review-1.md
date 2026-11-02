# AR0495 - Review 1

- Job: 2026-10-31-review-3da0eb65
- Branch: arthur/2026-10-31-worker-08a2d27a
- Commit reviewed: 644c482c34864078af2e9ed3d45d74fc94734bef
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0495 asks, end to end.

- **Zones** (`test/structure.ts:44-53`):
  - Green up to 200 lines prints nothing.
  - Yellow (201–220) adds a line to `zones`, worded as `<path>: N lines, yellow (over 200)`.
  - Red (221–250) passes only when the file is in `RED_FILES`. An unlisted red file fails, and the message names `RED_FILES` in `test/structure.test.ts` and the ticket's Decisions.
  - Above 250 fails whether the file is listed or not.
- **The list:** `RED_FILES` (`test/structure.test.ts:56`) is empty, sits beside `BUDGETS`, and is checked for name order.
- **Showing the files:** the repository test prints each zone line with `t.diagnostic`, which covers the ticket's "or the line the structure test prints" point. The worker's reason for skipping an `arthur doctor` check holds.
- **Boundary tests:** 200 (with and without a trailing newline), 201, 220, 221 listed and unlisted, 250 listed, and 251 listed and unlisted. That covers every boundary the ticket names.
- **Docs:** the styleguide's "Shape" and `review.md` give the zones, say a branch that moves a file into yellow or red must say why, and make a yellow or red file with an obvious split a finding.
- **Shape and scope:** package budgets are unchanged and `structure.ts` is 160 lines. No other boundary or Shape rule is touched.

## Notes
- (minor) `test/structure.ts:55-56`: the check that fails a stale `RED_FILES` entry goes beyond the ticket. The worker's final message gives the reason: without it, a file that shrank could grow back into red without a new Decision. It is small and tested.
- (minor) `spec/roadmap.md:27`: still describes the 200-line cap ("201 fails"). The worker recorded this as F1 in `findings.md` and left it open because the ticket's Scope does not name the roadmap.
- (minor) `test/structure.test.ts:131`: the name-order check on `RED_FILES` cannot fail while the list is empty. The worker's message says so.

## Checks
- `npm run check && npm test` in one call, timeout 1800 s: `tsc` passed with no errors; `ℹ tests 1405`, `ℹ pass 1343`, `ℹ fail 0`. This matches the worker's numbers.
- `npm run mutate`: the root `package.json` has no `mutate` script, so it was not run.
- One mutation by hand: in `test/structure.ts`, I changed the stale-entry condition from `listed && lines > YELLOW_LINES` to `listed && lines > GREEN_LINES`. `node --test test/structure.test.ts` then gave 18 pass, 1 fail (the stale-entry test). I restored the file with `git checkout -- test/structure.ts`, and `git status` showed a clean tree.

PASS