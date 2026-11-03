# AR0397 - Outcome

- Merged: 2026-11-03, `67b7e607`
- Branch: arthur/2026-11-03-worker-b6f730fb
- Reviews: review-1.md PASS
- Cost: worker $4.65, reviews $0.36; review rounds 1

## What went in

- `packages/orchestration/src/plans.ts`: the plan guard reads the ticket at HEAD and each plan.md with `--no-replace-objects`.
- `packages/projects/src/install.ts`: `projects.install` lists the commit's lockfiles with `--no-replace-objects`.
- `packages/projects/src/onboarding.ts`: an onboarding branch's diff against HEAD is read with `--no-replace-objects`.
- `packages/findings/src/findings-command.ts`: the branch lookup of `arthur findings` and `/findings` reads with `--no-replace-objects`.
- `packages/manage/src/audit.ts`: the audit's git reads (commits since the last audit, its date, HEAD) use `--no-replace-objects`.
- `packages/manage/src/retro-due.ts`: the retro period's git reads use `--no-replace-objects`.
- `packages/session/src/restart-guard.ts`: the restart guard's git reads use `--no-replace-objects`.
- `packages/delivery/src/ci-wait.ts`: a CI wait's tip check reads with `--no-replace-objects`, so a replacement does not end the wait.
- `packages/orchestration/test/plans.test.ts`: a replaced HEAD or approved commit does not change the plan guard's refusals.
- `packages/projects/test/install.test.ts`: a replaced HEAD does not change the install picked.
- `packages/projects/test/onboarding.test.ts`: a replaced branch tip does not let a change to another file through `merge.check`.
- `packages/findings/test/findings-command.test.ts`: a replaced branch tip does not change the findings.md shown.
- `packages/manage/test/audit.test.ts`: a replaced HEAD does not hide the commits since the last audit.
- `packages/manage/test/retro.test.ts`: a replaced HEAD does not hide the merges `retro-due` counts.
- `packages/session/test/restart-guard.test.ts`: a replaced merge does not hide a change to loaded code.
- `packages/delivery/test/auto-merge.test.ts`: a tip replaced by a tree does not end the CI wait.
- `docs/deploy.md`: the threat model names these reads as reading past any replacement.
- `test/structure.test.ts`: projects line budget raised from 594 to 595.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1431/1502 passed.

## Left open

- Findings: none; no findings.md on this ticket.
