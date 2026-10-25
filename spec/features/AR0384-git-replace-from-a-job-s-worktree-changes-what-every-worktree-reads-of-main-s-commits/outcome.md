# AR0384 - Outcome

- Merged: 2026-10-25, `185cc01f`
- Branch: h/2026-10-25-ar0384-git-replace-ee20b11a
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $6.02, reviews $1.22; review rounds 2

## What went in

- `packages/core/src/git-writes.ts`, `packages/core/src/worktree-guard.ts`: a job's `git replace` (delete, edit, graft or any non-list form, through an alias too) is refused; listing still passes.
- Arthur's own git calls in a main checkout (`git.ts`, `job-machine.ts`, `job-records.ts`, `remote-job.ts`, delivery's `auto-merge.ts`, `delivery.ts`, `merge-command.ts`, `review-command.ts`, `review-needed.ts`, github's `github-git.ts`) read past replace refs, so a replacement cannot change what they see of main.
- Tests in core, delivery and github for the refusal and for each hardened read. `docs/deploy.md`: one sentence. `test/structure.test.ts`: core budget 6071 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1092/1092 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/40150881076

## Left open

- Tickets from findings: AR0396 (F1), AR0397 (F2).
