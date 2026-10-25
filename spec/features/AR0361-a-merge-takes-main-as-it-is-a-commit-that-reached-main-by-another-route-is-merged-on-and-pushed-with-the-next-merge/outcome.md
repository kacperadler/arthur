# AR0361 - Outcome

- Merged: 2026-10-26, `e3164372`
- Branch: arthur/2026-10-25-worker-bb221b5b
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.42, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/merge-command.ts`: a merge refuses while main holds code commits its last merge commit did not bring (`rev-list --first-parent --merges -1`, then the commits since it outside `spec/`, `CHANGELOG.md` and `*.md`), naming each, newest first; with no merge yet it lists from the root; `--unreviewed`, `--auto` and `--no-ci` do not lift it; main is unchanged.
- `packages/delivery/docs/commands/merge.md`: the refusal, the owner's two ways out (reset main, or a merge commit that takes main as it is) and what the coordinator does.
- `packages/delivery/test/merge.test.ts`, `auto-merge.test.ts`, `test/ci-wait-wake.test.ts`: fixtures end main in a merge; two stray code commits are refused and named; spec and docs commits pass; the owner's merge lets the branch in; a repository with no merge names its root.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1129/1129 passed.

## Left open

- Tickets from findings: AR0441 (F1: a job's own merge commit resets the check), AR0442 (F2: a project with no merge refuses its first merge); both left at planning for the owner.
