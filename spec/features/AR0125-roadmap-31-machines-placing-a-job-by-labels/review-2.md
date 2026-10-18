# AR0125 - Review 2

- Job: 2026-10-18-review-ar0125-machine-pl-d0645951
- Branch: h/2026-10-18-ar0125-machine-placement-7dd32646
- Commit reviewed: 0aab2e14f670c9e17d26f125b57c28ea030e1cbe
- Verdict: PASS

## Final message

All checks pass; merge correctly combines main's three merged tickets (AR0120, AR0121, AR0126) with this branch's machine-placement feature. No regressions, no conflict markers, decisions and budgets align with the explicit follow-up instructions.

Findings: none.

Notes:
- The two `inbox.test.ts` timing tests the worker reported as flaky did not fail in my single full run (440/440 passed); consistent with the task's framing that this is AR0136 (already tracked separately), not this branch's regression.

Checks run (in this worktree, HEAD `0aab2e14f670c9e17d26f125b57c28ea030e1cbe`, matches `origin` for `h/2026-10-18-ar0125-machine-placement-7dd32646`):
- `npm run check` → passes, no errors (tsc).
- `npm test` → full suite, 440/440 pass, 0 fail, 0 skipped (single run, ~267s); includes `the repository keeps every rule` (structure/budgets) and `the README's mermaid block is arthur.mmd, unchanged`.
- `grep -rn '^<<<<<<<|^=======|^>>>>>>>'` across the tree → no conflict markers left.
- `packages/core/src/jobs.ts`: 200 lines exactly; keeps `sayUncapped`/`jobCaps` (from main) together with the placement line (`machines.pick(request.machine, request.requires, …)`) and the `job-started` event carrying `machine: machine.name`.
- `test/structure.test.ts` `BUDGETS`: `core 4764, "core/testing" 340, projects 320, orchestration 875, machines 375, resources 42` — matches both follow-up instructions exactly; comment history documents AR0120/AR0121/AR0126/AR0125 in order.
- `README.md`/`arthur.mmd`: machines in the `built` class and table row; resources stays `partial`/"in progress, 1 of 4 entries" as on main; the two files' mermaid blocks are identical (test confirms).
- Ticket `spec/features/AR0125.../ticket.md` Decisions: all five entries present, ending with "core 4764 (main 4751 plus this ticket's 13) accepted."
- `git ls-remote origin h/2026-10-18-ar0125-machine-placement-7dd32646` → `0aab2e14…`, matches reviewed commit; push confirmed.
- `git log main -1` / `origin/main` → `b0cf851`, matches the merge's claimed main tip.

PASS
