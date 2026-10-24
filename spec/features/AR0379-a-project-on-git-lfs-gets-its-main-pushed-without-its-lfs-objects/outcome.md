# AR0379 - Outcome

- Merged: 2026-10-25, `6df9b99b`
- Branch: h/2026-10-24-ar0379-lfs-push-58ca3d44
- Reviews: review-1.md PASS; merged unreviewed (--unreviewed): no PASS on 94ba788 (last PASS: 028e363, 2 commits since)
- Cost: worker $1.93, reviews $0.51; review rounds 1

## What went in

- `packages/github/src/github-git.ts`: `push` checks whether any `.gitattributes` in the branch's tip names `filter=lfs`; if so it runs `git lfs push origin refs/heads/<branch>` first (no prompt, own session, 60 s limit) and pushes the branch only when that succeeds. Without `git-lfs` on `PATH`, or when the upload fails, nothing is pushed and the line says why. The spawn, timeout and error line of both runs live in one helper, `gitAway`.
- `packages/github/docs/github.md`: "Pushes" describes the LFS step and its two refusals.
- `packages/github/test/github.test.ts`: tests with a fake `git-lfs` for a nested `.gitattributes`, a README that only mentions LFS, missing git-lfs, a failed upload (origin unchanged) and the order of upload and push.
- `test/structure.test.ts`: github's line budget 635 -> 647 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1077/1077 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/40138663045

## Left open

- Tickets from findings: AR0390 (F1), AR0391 (F2).
