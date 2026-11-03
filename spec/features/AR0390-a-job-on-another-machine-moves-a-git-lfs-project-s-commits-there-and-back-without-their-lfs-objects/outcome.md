# AR0390 - Outcome

- Merged: 2026-11-03, `ba124480`
- Branch: arthur/2026-11-03-worker-bb81d62e
- Reviews: review-1.md PASS
- Cost: worker $2.01, reviews $0.33; review rounds 1

## What went in

- `packages/core/src/git.ts`: `namesLfs(root, commit)` says whether a `.gitattributes` of the commit, in any folder, names `filter=lfs`.
- `packages/core/src/job-machine.ts`: `reach` refuses a Git LFS project (its base or the spawn's `fetch`) on another machine before any SSH step, naming the commit and the project.
- `packages/core/test/machine.test.ts`: a test of that refusal for a nested `.gitattributes` in the fetch and a root one in the base, with no SSH call and no record, and a non-LFS `.gitattributes` still going there.
- `packages/core/docs/commands/spawn.md`: the LFS refusal is in the list of a spawn's refusals on another machine.
- `docs/deploy.md`: "Another machine for jobs" says a Git LFS project's jobs run on `local` only, and why, with the refusal's message.
- `test/structure.test.ts`: the core's line budget is 7126 (was 7116).
- `spec/features/AR0390-a-job-on-another-machine-moves-a-git-lfs-project-s-commits-there-and-back-without-their-lfs-objects/findings.md`: new, with F1 (placement may pick another machine for an LFS project) and F2 (a branch made LFS there leaves its objects there).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1424/1495 passed.

## Left open

- Deferred (client summary): F1. The machines plugin may place a Git LFS project's spawn on another machine, which the core then refuses
- Deferred (client summary): F2. A job on another machine that makes its branch a Git LFS one leaves the LFS objects there
- Deferred (client summary): F3. Automatic placement can choose another machine for a Git LFS project
- Deferred (client summary): F4. A branch that becomes LFS on the machine leaves its objects there
